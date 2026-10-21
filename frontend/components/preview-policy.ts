export type PreviewPreference='3d'|'static';

export function choosePreviewMode({preference,saveData=false,memory,reducedMotion=false}:{preference?:string|null;saveData?:boolean;memory?:number;reducedMotion?:boolean}):PreviewPreference {
  if(preference==='static'||preference==='3d')return preference;
  return saveData||reducedMotion||(memory!==undefined&&memory<=2)?'static':'3d';
}
