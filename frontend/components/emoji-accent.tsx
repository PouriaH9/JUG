/** Decorative accents use Apple's color emoji font when available on the device. */
export default function EmojiAccent({children}:{children:string}) {
  return <span aria-hidden="true" style={{display:'inline-block',fontFamily:'"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',fontSize:'.8em',fontWeight:400,letterSpacing:0,lineHeight:1,marginInlineStart:'.28em',verticalAlign:'baseline',whiteSpace:'nowrap'}}>{children}</span>;
}
