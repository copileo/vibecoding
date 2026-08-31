const normalise=value=>String(value||'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

function removeDuplicateChoiceLabels(root=document){
  root.querySelectorAll('.choice-reference').forEach(choice=>{
    const summary=choice.querySelector(':scope > summary');
    const content=choice.querySelector(':scope > .choice-reference-content');
    if(!summary||!content)return;
    const choiceText=normalise(summary.textContent);
    if(!choiceText)return;
    const first=content.querySelector(':scope > .section');
    if(first&&normalise(first.textContent)===choiceText)first.remove();
  });
}

const observer=new MutationObserver(()=>removeDuplicateChoiceLabels());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>removeDuplicateChoiceLabels());
