(function(){
  'use strict';
  var M = window.RIWAYAT_MENU, cur = M.currency;
  var $ = function(s,r){return (r||document).querySelector(s)};
  var money = function(n){return cur+' '+n.toLocaleString('en-US')};
  var esc = function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

  $('#yr').textContent = new Date().getFullYear();

  /* Mobile nav */
  var nav = $('#nav'), tog = $('.nav-toggle');
  function setNav(open){nav.classList.toggle('open',open);tog.setAttribute('aria-expanded',open)}
  tog.addEventListener('click',function(){setNav(!nav.classList.contains('open'))});
  nav.addEventListener('click',function(e){if(e.target.tagName==='A')setNav(false)});

  /* Menu */
  var tabs = $('#menuTabs'), view = $('#menuView');
  $('#taxNote').textContent = M.taxNote + ' Dishes may change with the season.';
  var tabList = M.categories.map(function(c){return {id:c.id,label:c.name}});
  tabList.splice(1,0,{id:'buffets',label:'Buffets'});

  tabs.innerHTML = tabList.map(function(t,i){
    return '<button class="tab" role="tab" data-id="'+t.id+'" aria-selected="'+(i===0)+'">'+esc(t.label)+'</button>';
  }).join('');
  tabs.addEventListener('click',function(e){
    var b = e.target.closest('.tab'); if(!b) return;
    show(b.dataset.id);
    b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
  });

  function priceHtml(it){
    if(it.variants && it.variants.length>1)
      return '<div class="price">'+it.variants.map(function(v){return '<small>'+esc(v.label)+'</small>'+money(v.price)}).join('')+'</div>';
    return '<div class="price">'+money(it.price)+'</div>';
  }
  function itemHtml(it){
    return '<article class="item"><div><h5>'+esc(it.name)+(it.preorder?'<span class="tag">Pre-order</span>':'')+'</h5>'+
      (it.desc?'<p>'+esc(it.desc)+'</p>':'')+'</div>'+priceHtml(it)+'</article>';
  }
  function catHtml(c){
    return '<div class="cat-head"><p class="eyebrow" lang="ur" dir="rtl">'+esc(c.urdu)+'</p><h3>'+esc(c.name)+'</h3><p class="sub">'+esc(c.subtitle)+'</p><div class="orn" aria-hidden="true"></div></div>'+
      c.groups.map(function(g){
        return '<div class="group"><h4>'+esc(g.name)+'</h4>'+(g.note?'<p class="note">'+esc(g.note)+'</p>':'')+
          '<div class="items">'+g.items.map(itemHtml).join('')+'</div></div>';
      }).join('');
  }
  function buffetHtml(){
    return '<div class="cat-head"><p class="eyebrow" lang="ur" dir="rtl">بوفے</p><h3>Buffets</h3><p class="sub">Eat as much as you like, at one price per person</p><div class="orn" aria-hidden="true"></div></div>'+
    M.buffets.map(function(b){
      return '<article class="buffet"><div class="buffet-top"><div><h4>'+esc(b.name)+'</h4><span class="sub">'+esc(b.days)+'</span><ul>'+
        b.times.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul></div>'+
        '<div class="buffet-price"><span>Per person</span><b>'+money(b.pricePerPerson)+'</b>'+
        b.kidsNote.map(function(k){return '<span>'+esc(k)+'</span>'}).join('')+'</div></div>'+
        '<div class="buffet-grid">'+b.sections.map(function(s){
          return '<div><h5>'+esc(s.name)+'</h5><ul>'+s.dishes.map(function(d){return '<li>'+esc(d)+'</li>'}).join('')+'</ul></div>';
        }).join('')+'</div></article>';
    }).join('');
  }
  function show(id){
    Array.prototype.forEach.call(tabs.children,function(b){b.setAttribute('aria-selected',b.dataset.id===id)});
    if(id==='buffets') view.innerHTML = buffetHtml();
    else view.innerHTML = catHtml(M.categories.filter(function(c){return c.id===id})[0]);
  }
  show(tabList[0].id);

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
