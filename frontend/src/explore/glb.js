// Shared GLB loader: supports Draco-compressed models (decoder files live in frontend/draco/).
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
let draco = null;
export function makeGLTFLoader() {
  if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath("draco/"); }
  const l = new GLTFLoader(); l.setDRACOLoader(draco); return l;
}
