import bpy, os
from mathutils import Vector
root=r'D:/Projects/JUG/juggball3d BLENDER'
out=r'D:/Projects/JUG/jug website/outputs/jug/frontend/public/assets'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=root+'/packaging/jug-packaging-web.glb')
bpy.ops.import_scene.gltf(filepath=root+'/website_exports/jug-brown-ball-web.glb')
balls=list(bpy.context.selected_objects)
# Keep each branded ball intact as a separate parent for web animation.
for i in range(3):
 parent=bpy.data.objects.new('Packed_Ball_'+str(i+1),None);bpy.context.collection.objects.link(parent)
 for src in balls:
  ob=src if i==0 else src.copy()
  if i>0:bpy.context.collection.objects.link(ob)
  ob.parent=parent
 parent.location=(0,0,.041+i*.074)
 parent.rotation_euler=(.12*i,.1*i,.6*i)
bpy.ops.wm.save_as_mainfile(filepath=root+'/packaging/JUG_Three_Ball_Web_Scene.blend')
bpy.ops.export_scene.gltf(filepath=out+'/jug-three-ball-packaging.glb',export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
print('PACKAGING_SCENE_COMPLETE')
