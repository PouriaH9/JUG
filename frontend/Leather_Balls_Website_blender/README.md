# Website-ready leather balls

- leather-ball-brown.glb: brown leather, continuous two-panel seam, dark X stitching.
- leather-ball-two-tone.glb: matching brown and light tan leather panels, same stitching.

Both GLBs are self-contained glTF 2.0 files with embedded base-color and tangent-space normal textures. No external textures, studio floor, cameras, lights, or animation are required. Each model contains 52,176 triangles, three material groups, and 1024 px textures. Size is approximately 2.9 MB per model.

Scale: metres; diameter 0.073 m (73 mm). Pivot: ball centre. glTF uses Y up. For a configurator, load one variant at a time and reuse the loaded model rather than downloading it repeatedly. Use neutral environment lighting and color-managed rendering. Serve GLB files as model/gltf-binary.

Three.js: load with GLTFLoader, add gltf.scene, and use a camera distance appropriate to a 0.073 m object. No Draco or KTX decoder is needed. Base-color is sRGB; the normal map is linear.

The light/dark panel boundary is baked into the two-tone texture. For different leather colors, edit the Blender source and rebake; changing the whole leather material color affects both panels.

Editable sources (in the parent folder):
- Leather_Baseball_Two_Panel.blend
- Leather_Baseball_Two_Tone.blend

Validation: GLB structure checked, then imported into Blender and rendered again. This does not constitute a browser/device performance test.
