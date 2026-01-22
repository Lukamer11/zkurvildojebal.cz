
export const GameState = {
  stats:{},
  listeners:new Set(),
  setStats(s){
    this.stats = {...this.stats, ...s};
    this.listeners.forEach(fn=>fn(this.stats));
  },
  subscribe(fn){
    this.listeners.add(fn);
    return ()=>this.listeners.delete(fn);
  }
};
