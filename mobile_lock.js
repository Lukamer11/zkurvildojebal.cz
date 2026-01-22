(function(){
  function ensureBlock(){
    if(document.getElementById('portraitBlock')) return;
    const div=document.createElement('div');
    div.id='portraitBlock';
    div.innerHTML = '<div class="rotateBox">🔄<br>Otoč telefon na šířku</div>';
    document.body.appendChild(div);
  }
  function check(){
    ensureBlock();
    const isPortrait = window.innerHeight > window.innerWidth;
    const b=document.getElementById('portraitBlock');
    if(!b) return;
    if(isPortrait){
      b.style.display='flex';
      document.body.style.overflow='hidden';
    }else{
      b.style.display='none';
      document.body.style.overflow='';
    }
  }
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  document.addEventListener('DOMContentLoaded', check);
})();