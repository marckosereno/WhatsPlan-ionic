// ====================================================================
// WHATSPLAN — state/AppState.js
// Estado global de la app de mapa
// Patrón Observer — sin dependencia del chat
// ====================================================================

export class AppState {
  constructor() {
    this.state = {

      // ── Usuario ────────────────────────────────────────────────────
      currentUser:      null,   // objeto Supabase User
      avatarUrl:        '',     // URL cacheada del avatar

      // ── Mapa ───────────────────────────────────────────────────────
      currentCategory:  null,   // key activa (ej: 'RESTAURANTS')
      currentSubcat:    null,   // valor de subcategoría activa
      mapReady:         false,  // true cuando MapLibre dispara 'load'

      // ── GPS / ubicación ────────────────────────────────────────────
      userLocation:     null,   // { lat, lng } o null
      gpsActive:        false,

      // ── Actividades ────────────────────────────────────────────────
      activities:       [],     // lista de actividades activas en el mapa

      // ── UI ─────────────────────────────────────────────────────────
      panelExpanded:    false,  // panel inferior expandido
      superPanelOpen:   false,  // panel de super usuario

    };

    this._listeners = new Set();
  }

  // ── Observer ──────────────────────────────────────────────────────

  /**
   * Suscribir un listener. Devuelve función de cleanup.
   * @param {Function} fn - callback(newState, oldState)
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * Actualizar estado y notificar listeners.
   * @param {Object} updates
   */
  setState(updates) {
    const prev = { ...this.state };
    this.state = { ...this.state, ...updates };
    this._listeners.forEach(fn => {
      try { fn(this.state, prev); }
      catch (e) { console.error('AppState listener error:', e); }
    });
  }

  /**
   * Leer estado completo o una clave.
   * @param {string} [key]
   */
  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  // ── Usuario ───────────────────────────────────────────────────────

  setUser(user) {
    this.setState({
      currentUser: user,
      avatarUrl:   user?.user_metadata?.avatar_url || '',
    });
  }

  setAvatarUrl(url) {
    this.setState({ avatarUrl: url });
  }

  clearUser() {
    this.setState({ currentUser: null, avatarUrl: '' });
  }

  // ── Mapa ──────────────────────────────────────────────────────────

  setMapReady(ready = true) {
    this.setState({ mapReady: ready });
  }

  setCategory(key) {
    this.setState({ currentCategory: key, currentSubcat: null });
  }

  setSubcat(value) {
    this.setState({ currentSubcat: value });
  }

  clearCategory() {
    this.setState({ currentCategory: null, currentSubcat: null });
  }

  // ── GPS ───────────────────────────────────────────────────────────

  setUserLocation(lat, lng) {
    this.setState({ userLocation: { lat, lng }, gpsActive: true });
  }

  clearUserLocation() {
    this.setState({ userLocation: null, gpsActive: false });
  }

  // ── Actividades ───────────────────────────────────────────────────

  setActivities(list) {
    this.setState({ activities: list });
  }

  // ── UI ────────────────────────────────────────────────────────────

  setPanelExpanded(expanded) {
    this.setState({ panelExpanded: expanded });
  }

  setSuperPanelOpen(open) {
    this.setState({ superPanelOpen: open });
  }
}

// Singleton — una sola instancia para toda la app
export const appState = new AppState();
