// Post chain for this project. EffectComposer stays out of the main graph.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import * as P from "./palette.js";
import { breakTask } from "./pace.js";

const WHITE = new THREE.Color(P.pureWhite);
const HIDDEN = new THREE.Color(P.k1a3c48);

// Vignette is before OutputPass. A later pass would tone-map and encode sRGB again:
// materials skip both while the render target is not the screen, and OutputPass applies them once.
const VIGNETTE_OFFSET = 0.7;
const VIGNETTE_DARKNESS = 1;
// Full-strength tilt reaches this many CSS pixels. Inside the sharp band the radius is zero.
const TILT_EDGE_PX = 12;

function tiltWithBand(source, sample) {
  const uniforms = THREE.UniformsUtils.clone(source.uniforms);
  uniforms.band = { value: 0.2 };
  const decl = "uniform float r;";
  const line = sample === "h"
    ? "float hh = h * abs( r - vUv.y );"
    : "float vv = v * abs( r - vUv.y );";
  const next = sample === "h"
    ? "float hh = h * smoothstep(band, band + 0.22, abs(r - vUv.y));"
    : "float vv = v * smoothstep(band, band + 0.22, abs(r - vUv.y));";
  if (!source.fragmentShader.includes(decl) || !source.fragmentShader.includes(line)) {
    throw new Error("tilt shader shape changed");
  }
  return {
    name: source.name,
    uniforms,
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader
      .replace(decl, "uniform float r;\n\t\tuniform float band;")
      .replace(line, next),
  };
}

function colorTargetOk(gl, { samples, half }) {
  const fb = gl.createFramebuffer();
  const rb = gl.createRenderbuffer();
  if (!fb || !rb) return false;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  const format = half ? gl.RGBA16F : gl.RGBA8;
  let ok = false;
  gl.getError();
  try {
    if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, 4, 4);
    else gl.renderbufferStorage(gl.RENDERBUFFER, format, 4, 4);
    if (gl.getError() === gl.NO_ERROR) {
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
  } catch (err) {
    ok = false;
  }
  gl.deleteFramebuffer(fb);
  gl.deleteRenderbuffer(rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.getError();
  return ok;
}

export async function mountPost({ renderer, scene, camera, tier }) {
  // Phones often cannot multisample a half-float target. An incomplete buffer
  // leaves the canvas black, so the narrow tier skips MSAA and drops to bytes
  // when half-float itself is missing. Desktop GTAO still reads the color-pass depth.
  const gl = renderer.getContext();
  const full = tier === "full";
  let samples = full ? 4 : 0;
  let half = true;
  if (!colorTargetOk(gl, { samples, half: true })) {
    samples = 0;
    half = colorTargetOk(gl, { samples: 0, half: true });
  }
  renderer.state.reset();
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
    samples,
    ...(full ? { depthTexture: new THREE.DepthTexture(1, 1) } : {}),
  });
  const composer = new EffectComposer(renderer, rt);
  const kinds = ["render"];
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let gtao = null;
  let outline = null;
  let bloom = null;
  let hTilt = null;
  let vTilt = null;
  let vignette = null;

  if (tier === "full") {
    const { GTAOPass } = await import("three/addons/postprocessing/GTAOPass.js");
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.blendIntensity = 0.6;
    gtao.updateGtaoMaterial({ radius: 0.35, distanceFallOff: 1, thickness: 0.6 });
    // Normals come from the color-pass depth. A second scene render blew the 150-draw budget.
    gtao._renderGBuffer = false;
    gtao.gtaoMaterial.defines.NORMAL_VECTOR_TYPE = 0;
    gtao.gtaoMaterial.needsUpdate = true;
    gtao.pdMaterial.defines.NORMAL_VECTOR_TYPE = 0;
    gtao.pdMaterial.needsUpdate = true;
    const drawGtao = gtao.render.bind(gtao);
    gtao.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      const depth = readBuffer.depthTexture;
      gtao.gtaoMaterial.uniforms.tDepth.value = depth;
      gtao.pdMaterial.uniforms.tDepth.value = depth;
      drawGtao(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    composer.addPass(gtao);
    kinds.push("gtao");
  }

  if (tier !== "reduced") {
    outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    outline.edgeStrength = 4;
    outline.edgeGlow = 0.4;
    outline.edgeThickness = 1.5;
    outline.pulsePeriod = 0;
    outline.visibleEdgeColor.copy(WHITE);
    outline.hiddenEdgeColor.copy(HIDDEN);
    composer.addPass(outline);
    kinds.push("outline");

    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.5, 0.92);
    composer.addPass(bloom);
    kinds.push("bloom");

    if (tier === "full") {
      const [{ HorizontalTiltShiftShader }, { VerticalTiltShiftShader }] = await Promise.all([
        import("three/addons/shaders/HorizontalTiltShiftShader.js"),
        import("three/addons/shaders/VerticalTiltShiftShader.js"),
      ]);
      hTilt = new ShaderPass(tiltWithBand(HorizontalTiltShiftShader, "h"));
      vTilt = new ShaderPass(tiltWithBand(VerticalTiltShiftShader, "v"));
      hTilt.uniforms.r.value = 0.45;
      vTilt.uniforms.r.value = 0.45;
      hTilt.uniforms.band.value = 0.2;
      vTilt.uniforms.band.value = 0.2;
      composer.addPass(hTilt);
      composer.addPass(vTilt);
      kinds.push("tilt-h", "tilt-v");
    }

    vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = VIGNETTE_OFFSET;
    vignette.uniforms.darkness.value = VIGNETTE_DARKNESS;
    composer.addPass(vignette);
    kinds.push("vignette");
  }

  composer.addPass(new OutputPass());
  kinds.push("output");
  composer.setPixelRatio(1);
  composer.setSize(4, 4);
  if (gtao) {
    const depth = rt.depthTexture || new THREE.DepthTexture(4, 4);
    gtao.gtaoMaterial.uniforms.tDepth.value = depth;
    gtao.pdMaterial.uniforms.tDepth.value = depth;
    const pieces = [
      ["ao", gtao.gtaoMaterial, gtao.gtaoRenderTarget],
      ["denoise", gtao.pdMaterial, gtao.pdRenderTarget],
      ["copy", gtao.copyMaterial, null],
      ["blend", gtao.blendMaterial, null],
    ];
    for (const [name, material, target] of pieces) {
      await breakTask();
      gtao.renderPass(renderer, material, target, 0xffffff, 1);
    }
  }
  const enabled = composer.passes.map((pass) => pass.enabled);
  for (let i = 0; i < composer.passes.length; i += 1) {
    for (let j = 0; j < composer.passes.length; j += 1) composer.passes[j].enabled = j <= i;
    await breakTask();
    composer.render();
  }
  composer.passes.forEach((pass, index) => {
    pass.enabled = enabled[index];
  });

  function resize(cssW, cssH, pixelRatio) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(cssW, cssH);
    if (hTilt) hTilt.uniforms.h.value = (TILT_EDGE_PX / 4) / Math.max(1, cssW);
    if (vTilt) vTilt.uniforms.v.value = (TILT_EDGE_PX / 4) / Math.max(1, cssH);
  }

  function setBloom(stars) {
    if (!bloom) return;
    let strength = 0.18;
    let threshold = 0.92;
    if (stars > 0.8) {
      strength = 0.85;
      threshold = 0.55;
    } else if (stars >= 0.2) {
      strength = 0.45;
      threshold = 0.8;
    }
    bloom.strength = strength;
    bloom.threshold = threshold;
    bloom.radius = 0.5;
  }

  function setOutline(objects, { selected = false, accent = P.pureWhite } = {}) {
    if (!outline) return;
    outline.selectedObjects = objects;
    outline.edgeGlow = 0.4;
    outline.edgeThickness = 1.5;
    outline.hiddenEdgeColor.copy(HIDDEN);
    if (!objects.length) {
      outline.edgeStrength = 4;
      outline.pulsePeriod = 0;
      outline.visibleEdgeColor.copy(WHITE);
      return;
    }
    if (selected) {
      outline.visibleEdgeColor.set(accent);
      outline.edgeStrength = 5;
      outline.pulsePeriod = 2.4;
    } else {
      outline.visibleEdgeColor.copy(WHITE);
      outline.edgeStrength = 3;
      outline.pulsePeriod = 0;
    }
  }

  function setFocus(r, band = 0.2) {
    if (!hTilt) return;
    const focus = Number.isFinite(r) ? r : 0.45;
    const span = Number.isFinite(band) ? band : 0.2;
    hTilt.uniforms.r.value = focus;
    vTilt.uniforms.r.value = focus;
    hTilt.uniforms.band.value = span;
    vTilt.uniforms.band.value = span;
  }

  function setTilt(on) {
    const enabled = Boolean(on);
    if (hTilt) hTilt.enabled = enabled;
    if (vTilt) vTilt.enabled = enabled;
  }

  function setVignette(on) {
    if (vignette) vignette.enabled = Boolean(on);
  }

  function info() {
    return {
      tier,
      kinds: kinds.slice(),
      passes: composer.passes.length,
      samples: composer.renderTarget1.samples,
      half: half,
      bloom: bloom
        ? { strength: bloom.strength, threshold: bloom.threshold, radius: bloom.radius }
        : null,
      outline: outline
        ? {
          count: outline.selectedObjects.length,
          strength: outline.edgeStrength,
          pulse: outline.pulsePeriod,
          color: `#${outline.visibleEdgeColor.getHexString()}`,
        }
        : null,
      vignette: vignette
        ? {
          offset: vignette.uniforms.offset.value,
          darkness: vignette.uniforms.darkness.value,
          enabled: vignette.enabled !== false,
        }
        : null,
      focus: hTilt ? hTilt.uniforms.r.value : null,
      focusBand: hTilt ? hTilt.uniforms.band.value : null,
      tilt: hTilt ? hTilt.enabled !== false : false,
    };
  }

  const size = new THREE.Vector2();
  renderer.getSize(size);
  resize(size.x, size.y, renderer.getPixelRatio());

  return { composer, resize, setBloom, setOutline, setFocus, setTilt, setVignette, info, kinds };
}
