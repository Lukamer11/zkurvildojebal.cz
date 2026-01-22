
/* supabase_stub.js — offline Supabase-like API backed by localStorage */
(function(){
  const USERS_KEY = 'sf_users_v1';
  const SESSION_KEY = 'sf_session_v1';
  const TABLE_PREFIX = 'sf_table_';
  const BOT_SEED_KEY = 'sf_bots_seeded_v1';

  function load(key, fallback){
    try{ const v = localStorage.getItem(key); return v? JSON.parse(v): fallback; }catch(e){ return fallback; }
  }
  function save(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }
  function uid(){
    return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function seedBots(){
    if (localStorage.getItem(BOT_SEED_KEY)) return;
    const bots = [];
    const names = ["Viktor","Roman","Anna","Gomez","Boris","Igor","Maksim","Sergej","Oleg","Pavel","Nikita","Denis","Sasha","Misha","Yuri","Kiril","Vasya","Slava","Dima","Artem"];
    for(let i=0;i<40;i++){
      const name = names[i%names.length] + " #" + (i+1);
      const level = 1 + Math.floor(Math.random()*40);
      bots.push({
        id: "bot_"+i,
        user_id: "bot_"+i,
        username: name,
        level,
        xp: level*100,
        money: Math.floor(50 + Math.random()*5000),
        cig: Math.floor(Math.random()*800),
        energy: 100,
        max_energy: 100,
        str: 1+Math.floor(level*2 + Math.random()*10),
        def: 1+Math.floor(level*2 + Math.random()*10),
        crit: Math.floor(Math.random()*25),
        created_at: new Date().toISOString()
      });
    }
    const tblKey = TABLE_PREFIX+'player_stats';
    const rows = load(tblKey, []);
    // merge, don't duplicate
    const map = new Map(rows.map(r=>[r.user_id||r.id, r]));
    for(const b of bots) map.set(b.user_id, b);
    save(tblKey, Array.from(map.values()));
    localStorage.setItem(BOT_SEED_KEY, '1');
  }

  function makeQuery(table){
    const tblKey = TABLE_PREFIX+table;
    let rows = load(tblKey, []);
    let filters = [];
    let orderBy = null;
    let limitN = null;
    let wantSingle = False = false;

    const api = {
      select(cols='*'){ return api; },
      eq(col, val){ filters.push({col,val}); return api; },
      order(col, opts){ orderBy = {col, asc: !!(opts && opts.ascending)}; return api; },
      limit(n){ limitN = n; return api; },
      single(){ wantSingle = true; return api; },
      maybeSingle(){ wantSingle = true; return api; },
      async then(resolve, reject){ /* allow await on builder */ 
        try{ const res = await api._execSelect(); resolve(res); }catch(e){ reject(e); }
      },
      async _execSelect(){
        let data = rows.slice();
        for(const f of filters){
          data = data.filter(r => (r[f.col] === f.val));
        }
        if(orderBy){
          data.sort((a,b)=>{
            const av=a[orderBy.col], bv=b[orderBy.col];
            if(av===bv) return 0;
            return (av>bv?1:-1) * (orderBy.asc?1:-1);
          });
        }
        if(limitN!=null) data=data.slice(0, limitN);
        if(wantSingle) data = data[0] || null;
        return { data, error: null };
      },
      async insert(payload){
        const arr = Array.isArray(payload)? payload:[payload];
        const existing = load(tblKey, []);
        for(const row of arr){
          existing.push({...row});
        }
        save(tblKey, existing);
        return { data: arr, error: null };
      },
      update(values){
        return {
          eq: async (col,val)=>{
            let existing = load(tblKey, []);
            let updated=[];
            existing = existing.map(r=>{
              if(r[col]===val){
                const nr={...r, ...values};
                updated.push(nr);
                return nr;
              }
              return r;
            });
            save(tblKey, existing);
            return { data: updated, error: null };
          }
        };
      },
      async upsert(payload){
        const arr = Array.isArray(payload)? payload:[payload];
        let existing = load(tblKey, []);
        const map = new Map(existing.map(r=>[(r.user_id||r.id), r]));
        for(const row of arr){
          const k = row.user_id||row.id||uid();
          map.set(k, {...map.get(k), ...row});
        }
        const out = Array.from(map.values());
        save(tblKey, out);
        return { data: arr, error: null };
      },
      delete(){
        return {
          eq: async (col,val)=>{
            let existing=load(tblKey, []);
            const before=existing.length;
            existing=existing.filter(r=>r[col]!==val);
            save(tblKey, existing);
            return { data: {count: before-existing.length}, error:null };
          }
        };
      }
    };
    return api;
  }

  function createClient(url, anon, opts){
    seedBots();
    return {
      auth: {
        async signUp({email,password}){
          const users = load(USERS_KEY, []);
          if(users.find(u=>u.email===email)) return { data:null, error:{message:'User exists'} };
          const user = { id: uid(), email, password };
          users.push(user); save(USERS_KEY, users);
          const session = { user: { id:user.id, email:user.email } };
          save(SESSION_KEY, session);
          return { data:{user: session.user, session}, error:null };
        },
        async signInWithPassword({email,password}){
          const users = load(USERS_KEY, []);
          const user = users.find(u=>u.email===email && u.password===password);
          if(!user) return { data:null, error:{message:'Bad credentials'} };
          const session = { user: { id:user.id, email:user.email } };
          save(SESSION_KEY, session);
          return { data:{user: session.user, session}, error:null };
        },
        async signOut(){ localStorage.removeItem(SESSION_KEY); return { error:null }; },
        async getSession(){ return { data:{ session: load(SESSION_KEY, null) }, error:null }; },
        onAuthStateChange(cb){
          // minimal: fire once
          setTimeout(()=>{ cb('INITIAL_SESSION', { session: load(SESSION_KEY, null) }); },0);
          return { data:{ subscription:{ unsubscribe(){} } } };
        }
      },
      from(table){ return makeQuery(table); },
      async rpc(fn, params){
        // optional: implement a couple simple RPCs
        return { data: null, error: null };
      },
      channel(name){
        return { on(){ return this; }, subscribe(){ return this; }, unsubscribe(){} };
      }
    };
  }

  window.supabase = window.supabase || {};
  window.supabase.createClient = createClient;
})();
