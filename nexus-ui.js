/* Dream Nexus UI-only accessibility enhancement. No audio engine changes. */
(()=>{'use strict';
const overlay=document.getElementById('presetBrowserOverlay');
if(!overlay)return;
let returnFocus=null;
const isOpen=()=>!overlay.classList.contains('hidden');
const sync=()=>{const open=isOpen();document.body.classList.toggle('db-library-open',open);overlay.setAttribute('aria-hidden',String(!open));if(open){if(!returnFocus)returnFocus=document.activeElement;const close=document.getElementById('closePresetBrowser');if(close&&!overlay.contains(document.activeElement))close.focus({preventScroll:true});}else if(returnFocus){const target=returnFocus;returnFocus=null;if(target.isConnected)target.focus({preventScroll:true});}};
const observer=new MutationObserver(sync);observer.observe(overlay,{attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',event=>{if(!isOpen())return;if(event.key==='Escape'){event.preventDefault();document.getElementById('closePresetBrowser')?.click();return;}if(event.key!=='Tab')return;const focusable=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0&&!el.closest('[hidden]'));if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
sync();
})();
