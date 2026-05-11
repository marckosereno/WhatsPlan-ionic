  _showMiniCard(place, index, rawPhoto) {
    this._closeMiniCard();
    this.miniCardPlace  = place;
    this.miniCardMarker = this.markers[index];
    this.miniCardIndex  = index;
    const el = this.miniCardMarker.getElement();

    // Ocultar el pin original
    const pinRoot = el.querySelector('.place-pin-root');
    if (pinRoot) { pinRoot.style.visibility = 'hidden'; pinRoot.style.pointerEvents = 'none'; }

    // Crear minicard posicionada fija en el centro de la pantalla, por encima de todo
    const miniWrap = document.createElement('div');
    miniWrap.id = 'active-minicard';
    miniWrap.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-60%);z-index:99999;width:auto;height:auto;overflow:visible;pointer-events:auto;';

    const rating  = place.rating ? `⭐ ${Number(place.rating).toFixed(1)}` : '';
    const address = (place.formattedAddress || place.formatted_address || '').substring(0, 32);
    const hasAct  = this._activityCount(place) > 0;
    const cat     = window.wpApp?.categories?.[place.category] || {};
    const cardGrad = cat.gradient || 'linear-gradient(135deg,#667eea,#764ba2)';
    const miniPhoto = rawPhoto || place.photo_url || place.photoUrl || '';
    const name = (place.name || '').length > 22 ? place.name.substring(0, 22) + '…' : (place.name || '');

    miniWrap.innerHTML = `
      <div class="minicard-wrap">
        ${miniPhoto ? `<img src="${miniPhoto}" class="minicard-photo" onerror="this.style.display='none'">` : `<div class="minicard-icon" style="background:${cardGrad}">${cat?.icon||'💎'}</div>`}
        <div class="minicard-body">
          <div class="minicard-name">${name}</div>
          <div class="minicard-meta">${[rating, address].filter(Boolean).join(' · ')}</div>
          ${hasAct ? `<div class="minicard-act-badge">🗓 Actividades</div>` : ''}
        </div>
        <button class="minicard-close">✕</button>
      </div>`;

    miniWrap.querySelector('.minicard-wrap').addEventListener('click', (e) => {
      if (e.target.classList.contains('minicard-close')) return;
      e.stopPropagation();
      this.haptic('select');
      window.wpApp?.openPlaceDetail?.(place);
    });
    miniWrap.querySelector('.minicard-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeMiniCard();
    });

    // Añadir al body para que quede por encima de todo
    document.body.appendChild(miniWrap);
    this._miniWrapEl = miniWrap;
    const lat = place.location?.lat ?? place.lat;
    const lng = place.location?.lng ?? place.lng;
    this.map.easeTo({ center: [lng, lat], duration: 300 });
  }

  _closeMiniCard() {
    const mini = document.getElementById('active-minicard');
    if (mini) mini.remove();
    // Restaurar visibilidad del pin del marcador activo
    if (this.miniCardMarker) {
      const el = this.miniCardMarker.getElement();
      if (el) {
        const pinRoot = el.querySelector('.place-pin-root');
        if (pinRoot) { pinRoot.style.visibility = ''; pinRoot.style.pointerEvents = ''; }
      }
    }
    this._miniWrapEl = null;
    this.miniCardMarker = null; this.miniCardIndex = -1; this.miniCardPlace = null;
  }
