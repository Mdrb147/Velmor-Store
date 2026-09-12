'use strict';
// Shared accessible password visibility, including dynamically opened forms.
(()=>{
 let nextId=0;
 function enhance(){
  document.querySelectorAll('input[type="password"]:not([data-reveal-ready])').forEach(input=>{
   input.dataset.revealReady='true';
   if(!input.id)input.id='secure-password-'+(++nextId);
   const wrapper=document.createElement('span');wrapper.className='password-field';
   const toggle=document.createElement('button');toggle.type='button';toggle.className='password-reveal';toggle.textContent='إظهار';
   toggle.setAttribute('aria-controls',input.id);toggle.setAttribute('aria-label','إظهار كلمة المرور');toggle.setAttribute('aria-pressed','false');
   input.before(wrapper);wrapper.append(input,toggle);
   toggle.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'إخفاء':'إظهار';toggle.setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور');toggle.setAttribute('aria-pressed',String(show));});
  });
 }
 enhance();new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
})();
