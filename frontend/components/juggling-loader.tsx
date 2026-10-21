export default function JugglingLoader({label='در حال بارگذاری',progress}:{label?:string;progress?:number}) {
  const value=progress===undefined?undefined:Math.max(0,Math.min(100,Math.floor(progress)));
  return <span className="juggling-loading">
    <span className="juggling-loader" role="status" aria-label={label}><span aria-hidden="true"/><span aria-hidden="true"/><span aria-hidden="true"/></span>
    {value!==undefined&&<span className="juggling-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span dir="ltr">{value}%</span>
    </span>}
  </span>;
}
