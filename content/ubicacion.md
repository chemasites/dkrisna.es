+++
title = "Ubicación y contacto en Caravaca de la Cruz"
description = "Visita D'Krisna en Carretera de Murcia, 45, Caravaca de la Cruz, Murcia. Horario: Lunes a Sábado 9:00-21:00."
template = "page.html"

[extra]
show_cta = true
+++

<div class="location-full">
<div class="location-details">
<div class="location-header">
<span class="section-label">Contacto</span>
<h2 class="location-title">Cómo Encontrarnos</h2>
<p class="location-subtitle">Todo lo que necesitas saber para visitarnos. Dirección, horarios de atención y formas de contacto a tu disposición.</p>
</div>
<div class="location-info-cards">
<div class="info-card">
<div class="info-icon">
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
</div>
<h3>Dirección</h3>
<p>{{ business_address() }}</p>
</div>

<div class="info-card">
<div class="info-icon">
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
</div>
<h3>Teléfono</h3>
<p>{{ business_phone() }}</p>
<p class="small">Llámanos o {% whatsapp_link() %}envía un WhatsApp{% end %}</p>
</div>

<div class="info-card">
<div class="info-icon">
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
</div>
<h3>Horario</h3>
{{ business_hours() }}
</div>
</div>
</div>

<div class="location-map-full">
<div class="location-header">
<span class="section-label">Ubicación</span>
<h2 class="location-title">Encuéntranos</h2>
<p class="location-subtitle">Estamos en Caravaca de la Cruz, listos para recibirte. Te esperamos para ofrecerte la mejor experiencia.</p>
</div>
<div class="map-container">
{{ business_map() }}
</div>
</div>
</div>
