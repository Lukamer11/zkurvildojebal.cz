(()=>{try{window.SF_LANG_PACK=window.SF_LANG_PACK||window.SF_LANG_PACK;}catch(e){}})();
/* patched for offline */
(function(){
  const KEY = "sf_lang";
  let LANG = (localStorage.getItem(KEY) || "cs");
  let DICT = {};

  async function load(lang){
    LANG = lang || "cs";
    localStorage.setItem(KEY, LANG);
    try{
      const res = await (window.SF_LANG_PACK?Promise.resolve({json:()=>Promise.resolve(window.SF_LANG_PACK[lang]||{})}):fetch(`lang/${LANG}.json`, {cache:"no-store"}));
      DICT = await res.json();
    }catch(e){
      DICT = {};
    }
    apply();
  }

  function t(key, fallback){
    return (DICT && DICT[key]) || fallback || key;
  }

  function apply(root){
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el=>{
      const k = el.getAttribute("data-i18n");
      el.textContent = t(k, el.textContent);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
      const k = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(k, el.getAttribute("placeholder")||""));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(el=>{
      const k = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(k, el.getAttribute("title")||""));
    });
  }

  window.SF = window.SF || {};
  window.SF.i18n = { load, t, apply, getLang:()=>LANG };

  document.addEventListener("DOMContentLoaded", ()=>load(LANG));
})();
