// guild.js - FIXED VERSION
(() => {
  'use strict';

  // ====== SUPABASE CONFIG ======
  const SUPABASE_URL = 'https://jbfvoxlcociwtyobaotz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No';

  let supabase = null;

  // ====== CONFIG ======
  const CONFIG = {
    CREATE_COST_CIGS: 100,
    MAX_MEMBERS: 50,
    DONATE_COOLDOWN: 30000
  };

  // ====== PLAYER ======
  class Player {
    static getUserId() {
      return localStorage.getItem('user_id') || '1';
    }

    static getName() {
      return localStorage.getItem('playerName') || 'PLAYER';
    }

    static getMoney() {
      const el = document.getElementById('money');
      return el ? Number(el.textContent.replace(/\D/g, '')) : 0;
    }

    static getCigs() {
      const el = document.getElementById('cigarettes');
      return el ? Number(el.textContent.replace(/\D/g, '')) : 0;
    }

    static getLevel() {
      const el = document.getElementById('levelDisplay');
      return el ? Number(el.textContent) || 1 : 1;
    }

    static setMoney(v) {
      const el = document.getElementById('money');
      if (el) el.textContent = v.toLocaleString('cs-CZ');
    }

    static setCigs(v) {
      const el = document.getElementById('cigarettes');
      if (el) el.textContent = v.toLocaleString('cs-CZ');
    }
  }

  // ====== UI ======
  class UI {
    static showLoading() {
      const loading = document.getElementById('loadingScreen');
      const welcome = document.getElementById('welcomeScreen');
      const browser = document.getElementById('guildBrowser');
      const myGuild = document.getElementById('myGuildView');

      if (loading) loading.style.display = 'flex';
      if (welcome) welcome.style.display = 'none';
      if (browser) browser.style.display = 'none';
      if (myGuild) myGuild.style.display = 'none';
    }

    static hideLoading() {
      const loading = document.getElementById('loadingScreen');
      if (loading) loading.style.display = 'none';
    }

    static showModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('show');
    }

    static hideModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }

    static toast(text, type = 'ok', timeout = 3000) {
      const toast = document.createElement('div');
      toast.className = `guild-toast ${type}`;
      toast.textContent = text;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), timeout);
    }

    static formatNumber(num) {
      return Number(num || 0).toLocaleString('cs-CZ');
    }
  }

  // ====== INIT ======
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ guild.js loaded without syntax errors');
  });

})();
