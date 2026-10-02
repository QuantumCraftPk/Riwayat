(function(){
  'use strict';
  var $ = function(s,r){return (r||document).querySelector(s)};
  var esc = function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

  $('#yr').textContent = new Date().getFullYear();

  /* Mobile nav */
  var nav = $('#nav'), tog = $('.nav-toggle');
  function setNav(open){nav.classList.toggle('open',open);tog.setAttribute('aria-expanded',open)}
  tog.addEventListener('click',function(){setNav(!nav.classList.contains('open'))});
  nav.addEventListener('click',function(e){if(e.target.tagName==='A')setNav(false)});

  /* Gallery */
  var G = [
    ['main-elevation','Main Elevation, MM Alam Road'],['grand-entrance','Grand Entrance'],
    ['main-dining-hall','Main Dining Hall'],['courtyard-dining','Courtyard Dining'],
    ['buffet-biryani','The Royal Buffet'],['rooftop-dining','Rooftop Dining'],
    ['live-kitchen','Live Kitchen'],['grand-private-vvip','Grand Private (VVIP)'],
    ['bbq-station','BBQ Station'],['rooftop-sunset','Rooftop Lounge, Sunset'],
    ['dessert-station','Dessert Station'],['private-dining-room','Private Dining Room'],
    ['international-buffet','International Buffet'],['intimate-alcove','Intimate Dining Alcove'],
    ['live-kitchen-bbq','Live Kitchen & BBQ'],['rooftop-night','Rooftop Lounge, Night']
  ];
  $('#galleryGrid').innerHTML = G.map(function(g){
    return '<figure class="g-item" data-src="assets/gallery/'+g[0]+'.jpg" data-cap="'+esc(g[1])+'" tabindex="0" role="button" aria-label="Open '+esc(g[1])+'">'+
      '<img src="assets/gallery/'+g[0]+'.jpg" alt="'+esc(g[1])+'" loading="lazy"><figcaption>'+esc(g[1])+'</figcaption></figure>';
  }).join('');
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  function openLb(f){lbImg.src=f.dataset.src;lbImg.alt=f.dataset.cap;lbCap.textContent=f.dataset.cap;lb.hidden=false}
  function closeLb(){lb.hidden=true;lbImg.src=''}
  $('#galleryGrid').addEventListener('click',function(e){var f=e.target.closest('.g-item');if(f)openLb(f)});
  $('#galleryGrid').addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){var f=e.target.closest('.g-item');if(f){e.preventDefault();openLb(f)}}});
  lb.addEventListener('click',function(e){if(e.target!==lbImg)closeLb()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!lb.hidden)closeLb()});
})();
