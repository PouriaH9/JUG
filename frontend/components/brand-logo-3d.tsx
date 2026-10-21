import {assetPath} from './preview-client';

/** Blender-rendered logo: one shared responsive asset, no extra WebGL context. */
export default function BrandLogo3D({priority=false}:{priority?:boolean}) {
  return <div className="stage-brand-mark" aria-hidden="true">
    <img
      src={assetPath('/assets/jug-logo-3d-front-1024-optimized.webp')}
      srcSet={`${assetPath('/assets/jug-logo-3d-front-512-optimized.webp')} 512w, ${assetPath('/assets/jug-logo-3d-front-1024-optimized.webp')} 1024w`}
      sizes="(max-width: 720px) 90vw, 760px"
      width={1024} height={1024} alt=""
      loading="eager" decoding="async" fetchPriority={priority?'high':'auto'}
      draggable={false}
    />
  </div>;
}

