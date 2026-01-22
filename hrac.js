// hrac.js – profil hráče z žebříčku + akce (mail / přátelé)
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const avatar = $('playerIcon');
  const clsBadge = $('profileClassBadge');
  const nameEl = $('playerName');
  const subEl = $('playerSub');
  const btnMail = $('btnMail');
  const btnFriend = $('btnFriend');
  const noteEl = $('note');

  const CLASS_META = {
    padouch: { icon: '👻', label: 'Padouch' },
    rvac:    { icon: '✊', label: 'Rváč' },
    mozek:   { icon: '💡', label: 'Mozek' }
  };

  function fmtInt(n){ return Number(n ?? 0).toLocaleString('cs-CZ'); }

  function setMsg(text, ok=true){
    if (!noteEl) return;
    noteEl.textContent = text;
    noteEl.style.color = ok ? '#67ff8d' : '#ff5353';
  }

  function getSb(){
    return window.supabaseClient || null;
  }

  function getTargetId(){
    const p = new URLSearchParams(location.search);
    return p.get('id') || p.get('user_id') || '';
  }

  function renderStats(stats){
    const map = {
      strength: '⚔️ Síla',
      defense: '🛡️ Obrana',
      constitution: '💪 Výdrž',
      luck: '🍀 Štěstí'
    };

    const box = $('statsGrid');
    box.innerHTML = '';

    Object.keys(map).forEach((k) => {
      const v = Number(stats?.[k] ?? 0);
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="label">${map[k]}</span><b class="value">${fmtInt(v)}</b>`;
      box.appendChild(row);
    });
  }

  async function load(){
    if (window.SFReady) await window.SFReady;
    const sb = getSb();
    const id = getTargetId();
    if (!sb || !id){
      setMsg('Chybí ID hráče v URL.', false);
      return;
    }

    const { data, error } = await sb
      .from('player_stats')
      // select('*') = bezpečné i když některé sloupce (např. nickname) v DB nejsou
      .select('*')
      .eq('user_id', id)
      .limit(1);

    if (error){
      console.error(error);
      setMsg('Nepodařilo se načíst hráče.', false);
      return;
    }

    const row = data?.[0];
    if (!row){
      setMsg('Hráč nenalezen.', false);
      return;
    }

    const nick = row.nickname || row.nick || row.name || row.username || (row.email ? String(row.email).split('@')[0] : `PLAYER ${String(row.user_id).slice(0,6)}`);
    if (nameEl) nameEl.textContent = nick;
    if (subEl) subEl.textContent = `Level ${row.level ?? 1} • XP ${fmtInt(row.xp ?? 0)} • 🪙 ${fmtInt(row.money ?? 0)} • 🚬 ${fmtInt(row.cigarettes ?? 0)}`;

    // class badge
    const clsKey = String(row.stats?.player_class || 'padouch').toLowerCase();
    const meta = CLASS_META[clsKey] || CLASS_META.padouch;
    if (clsBadge) {
      clsBadge.textContent = meta.icon;
      clsBadge.title = meta.label;
    }

    renderStats(row.stats || {});

    // actions
    btnMail.addEventListener('click', () => {
      // otevře mail compose s předvyplněným příjemcem = user_id
      window.location.href = `mail.html?to=${encodeURIComponent(row.user_id)}&name=${encodeURIComponent(nick)}`;
    });

    btnFriend.addEventListener('click', async () => {
            const myId = window.SF?.user?.id || window.SF?.stats?.user_id || '';
      if (!myId){
        setMsg('Musíš být přihlášený.', false);
        return;
      }
      if (String(myId) === String(row.user_id)){
        setMsg('Sebe do přátel nepřidáš 😅', false);
        return;
      }

      // Pokus 1: tabulka friends (pokud existuje)
      try{
        const payload = { user_id: myId, friend_id: row.user_id, created_at: new Date().toISOString() };
        const { error: insErr } = await sb.from('friends').insert(payload);
        if (!insErr){
          setMsg('Přidáno do přátel ✅');
          return;
        }
        console.warn('friends insert failed:', insErr);
      }catch(e){
        console.warn('friends insert exception:', e);
      }

      // Fallback: pošli mail "žádost o přátelství"
      setMsg('Nemám tabulku friends – posílám žádost přes MAIL…');
      window.location.href = `mail.html?to=${encodeURIComponent(row.user_id)}&name=${encodeURIComponent(nick)}&subject=${encodeURIComponent('Žádost o přátelství')}`;
    });

    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.addEventListener('click', () => history.back());

    setMsg('Profil načten ✅');
  }

  document.addEventListener('DOMContentLoaded', load);
})();
