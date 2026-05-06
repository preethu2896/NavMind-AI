/**
 * StreetPreview.jsx
 * ─────────────────
 * Fetches the nearest Mapillary street-level image for a given [lat, lng]
 * and renders it as a lightweight inline preview panel.
 *
 * Dependencies: none beyond React (uses native fetch + import.meta.env).
 * Mapillary Graph API v4:
 *   GET https://graph.mapillary.com/images
 *       ?fields=id,thumb_1024_url,geometry,captured_at,compass_angle
 *       &closeto=<lng>,<lat>
 *       &radius=500
 *       &limit=1
 *       &access_token=<VITE_MAPILLARY_TOKEN>
 */

import { useState, useCallback } from 'react';

// ── Mapillary token (set VITE_MAPILLARY_TOKEN in frontend/.env) ───────────────
const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN ?? '';
const MAPILLARY_API   = 'https://graph.mapillary.com/images';
const SEARCH_RADIUS   = 500; // metres

// ── Helper: compute the midpoint index of an ORS geometry array ───────────────
function routeMidpoint(geometry) {
  // geometry is [[lng, lat], ...] from ORS
  if (!geometry || geometry.length === 0) return null;
  const mid = geometry[Math.floor(geometry.length / 2)];
  return { lat: mid[1], lng: mid[0] };
}

// ── Fetch nearest Mapillary image ─────────────────────────────────────────────
async function fetchNearestImage(lat, lng) {
  if (!MAPILLARY_TOKEN) {
    throw new Error('VITE_MAPILLARY_TOKEN is not set in frontend/.env');
  }

  // Approx 0.0045 degrees = 500m
  const d = 0.0045;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;

  const params = new URLSearchParams({
    fields:       'id,thumb_1024_url,geometry,captured_at,compass_angle',
    bbox:         bbox,
    limit:        1,
    access_token: MAPILLARY_TOKEN,
  });

  const res = await fetch(`${MAPILLARY_API}?${params}`);
  if (!res.ok) throw new Error(`Mapillary API error: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const images = json.data ?? [];
  if (images.length === 0) return null;

  const img = images[0];
  return {
    id:         img.id,
    thumbUrl:   img.thumb_1024_url,
    capturedAt: img.captured_at ? new Date(img.captured_at).toLocaleDateString() : 'Unknown',
    angle:      img.compass_angle != null ? Math.round(img.compass_angle) : null,
    mlyUrl:     `https://www.mapillary.com/app/?pKey=${img.id}`,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * Props:
 *   geometry   — raw ORS geometry array [[lng,lat],…] from the active route
 *   routeLabel — e.g. "Route A" (for the panel title)
 */
export default function StreetPreview({ geometry, routeLabel = 'Route' }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [image,   setImage]   = useState(null);
  const [midpt,   setMidpt]   = useState(null);

  const handleOpen = useCallback(async () => {
    // Toggle off
    if (open) { setOpen(false); return; }

    const mp = routeMidpoint(geometry);
    if (!mp) { setError('No route geometry available.'); setOpen(true); return; }

    setMidpt(mp);
    setOpen(true);
    setLoading(true);
    setError(null);
    setImage(null);

    try {
      const img = await fetchNearestImage(mp.lat, mp.lng);
      setImage(img);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [open, geometry]);

  const handleClose = (e) => {
    e.stopPropagation();
    setOpen(false);
  };

  return (
    <div className="street-preview-wrap">
      {/* ── Trigger button ── */}
      <button
        className={`btn-street-preview ${open ? 'btn-street-preview--open' : ''}`}
        onClick={handleOpen}
        aria-expanded={open}
        title={`View street-level preview for ${routeLabel}`}
      >
        <span className="street-preview-btn__icon">🛣</span>
        {open ? 'Hide Street Preview' : 'View Street Preview'}
      </button>

      {/* ── Expandable panel ── */}
      {open && (
        <div className="street-preview-panel" role="region" aria-label="Street Preview">
          <div className="street-preview-panel__header">
            <span className="street-preview-panel__title">
              📸 Street Preview — {routeLabel} midpoint
              {midpt && (
                <span className="street-preview-panel__coords">
                  {midpt.lat.toFixed(4)}, {midpt.lng.toFixed(4)}
                </span>
              )}
            </span>
            <button
              className="street-preview-panel__close"
              onClick={handleClose}
              aria-label="Close street preview"
            >
              ✕
            </button>
          </div>

          <div className="street-preview-panel__body">
            {/* Loading */}
            {loading && (
              <div className="sp-state sp-state--loading">
                <div className="sp-spinner" />
                <span>Searching for nearby street imagery…</span>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="sp-state sp-state--error">
                <span className="sp-state__icon">⚠️</span>
                <div>
                  <p className="sp-state__title">Could not load street preview</p>
                  <p className="sp-state__detail">{error}</p>
                  {error.includes('VITE_MAPILLARY_TOKEN') && (
                    <p className="sp-state__hint">
                      Add <code>VITE_MAPILLARY_TOKEN=your_token</code> to{' '}
                      <code>frontend/.env</code> and restart Vite.{' '}
                      <a href="https://www.mapillary.com/dashboard/developers" target="_blank" rel="noreferrer">
                        Get a free token →
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* No results */}
            {!loading && !error && image === null && (
              <div className="sp-state sp-state--empty">
                <span className="sp-state__icon">🔍</span>
                <div>
                  <p className="sp-state__title">No street imagery found nearby</p>
                  <p className="sp-state__detail">
                    No Mapillary images within {SEARCH_RADIUS} m of the route midpoint.
                    Try a route through a more urban area.
                  </p>
                </div>
              </div>
            )}

            {/* Success */}
            {!loading && !error && image && (
              <div className="sp-result">
                <div className="sp-result__img-wrap">
                  <img
                    src={image.thumbUrl}
                    alt={`Street view near ${routeLabel} midpoint`}
                    className="sp-result__img"
                    loading="lazy"
                  />
                  <div className="sp-result__overlay">
                    {image.angle != null && (
                      <span className="sp-badge sp-badge--angle">
                        🧭 {image.angle}°
                      </span>
                    )}
                    <span className="sp-badge sp-badge--date">
                      📅 {image.capturedAt}
                    </span>
                  </div>
                </div>

                <div className="sp-result__meta">
                  <p className="sp-result__caption">
                    Street-level imagery near the <strong>{routeLabel}</strong> midpoint
                    ({midpt?.lat.toFixed(4)}, {midpt?.lng.toFixed(4)})
                  </p>
                  <a
                    href={image.mlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="sp-result__link"
                  >
                    Open in Mapillary ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Attribution */}
          <p className="street-preview-panel__attribution">
            Imagery © <a href="https://www.mapillary.com" target="_blank" rel="noreferrer">Mapillary</a>
            , licensed under CC BY-SA 4.0
          </p>
        </div>
      )}
    </div>
  );
}
