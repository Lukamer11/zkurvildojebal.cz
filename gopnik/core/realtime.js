
import { getSupabase } from "./supabaseClient.js";
import { GameState } from "./gameState.js";

const sb = getSupabase();

export function initRealtime(userId){
  if(!userId) return;
  sb.channel("player_stats:"+userId)
    .on("postgres_changes",
      { event:"*", schema:"public", table:"player_stats", filter:`user_id=eq.${userId}`},
      payload => {
        if(payload.new){
          GameState.setStats(payload.new);
        }
      }
    ).subscribe();
}
