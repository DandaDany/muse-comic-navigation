(function(){
"use strict";
function n(s){return String(s||"").normalize("NFKC").toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）【】\[\]「」『』\-—_]/g,"");}
function arr(x){return Array.isArray(x)?x:[];}
function has(q, words){return arr(words).some(function(w){var z=n(w);return z&&q.indexOf(z)!==-1;});}
function money(v){return typeof v==="number"?"NT$"+v.toLocaleString("zh-TW"):null;}
function mediaFor(key){var K=window.MUSE_CONSUMER_KB;if(!key||!K||!K.media_assets)return null;var m=K.media_assets[key];if(!m||m.consumer_safe===false)return null;return Object.assign({key:key},m);}
function withMedia(obj,key){var m=mediaFor(key);if(m){obj.mediaKey=key;obj.media=m;}return obj;}
function intent(q){
 if(has(q,["多少錢","價格","售價","多少","價錢"])) return "price";
 if(has(q,["在哪","哪裡","幾號櫃","位置","怎麼找"])) return "location";
 if(has(q,["運費","宅配","出貨","到貨","配送"])) return "shipping";
 if(has(q,["有貨","還有嗎","售完","庫存","剩幾個","買得到嗎"])) return "stock";
 if(has(q,["文化幣","折價券","點數","滿額贈","刷卡","付款"])) return "policy";
 if(has(q,["幾款","款式","有哪些","賣什麼","有什麼","內容物"])) return "contents";
 return "general";
}
function scoreNames(q, names){var s=0;arr(names).forEach(function(x){var z=n(x);if(!z)return;if(q===z)s+=100;else if(q.indexOf(z)!==-1)s+=Math.max(10,z.length*4);});return s;}
function productText(p, it){
 var bits=[]; bits.push("【"+(p.ip?p.ip+" ":"")+p.name+"】");
 if(p.price!=null) bits.push((p.price_note||"售價")+"："+money(p.price)); else if(p.price_note) bits.push(p.price_note+"。");
 if(p.sale_type) bits.push("販售方式："+p.sale_type+"。");
 if(p.variants&&p.variants.length) bits.push("款式："+p.variants.join("、")+"。");
 if(p.shipping) bits.push("配送："+p.shipping+"。");
 if(p.availability) bits.push("供貨資訊："+p.availability+"。");
 if(p.details&&p.details.length) bits.push(p.details.join("；")+"。");
 if(p.live_confirmation_required) bits.push("即時庫存請以現場為準。");
 return bits.join(" ");
}
function answerProduct(p,it){
 if(it==="price") return p.price!=null?"【"+(p.ip?p.ip+" ":"")+p.name+"】"+(p.price_note||"售價")+"為"+money(p.price)+"。"+(p.live_confirmation_required?"實際庫存請以現場為準。":""):"文件有列出這項商品，但沒有清楚標示價格；請以精選區現場價牌為準。";
 if(it==="shipping") return p.shipping?"【"+p.name+"】"+p.shipping+"。"+(p.availability?" "+p.availability+"。":""):"文件沒有列出這項商品的個別配送資訊；請以現場訂購說明為準。";
 if(it==="stock") return "展前資料顯示有規劃販售【"+(p.ip?p.ip+" ":"")+p.name+"】，但靜態資料無法確認即時庫存或是否售完，請以現場展示與工作人員回覆為準。";
 if(it==="location"){if(p.id==="sel_reborn_ring")return "家庭教師《彭哥列戒指收藏組》不在精選商品區。家庭教師商品規劃在主攤位 6 號櫃附近；戒指的實際預購／購買位置如有調整，請以現場櫃號牌與工作人員指引為準。";return "【"+p.name+"】在「"+({main_booth:"主攤位商品區",selected:"精選商品／一番賞區",lucky_bag:"福袋區",movie:"電影票區",machine:"機台區"}[p.zone]||"木棉花攤位")+"」。";}
 return productText(p,it);
}
function findAnswer(text,opts){
 opts=opts||{}; var K=window.MUSE_CONSUMER_KB, q=n(text), it=intent(q);
 if(!q)return {found:false,type:"fallback",answer:K.meta.fallback_answer};
 if(has(q,K.internal_guardrails.blocked_topics)||((has(q,["員工","工讀","正職","工作人員"]))&&has(q,["打卡","簽到","簽退","排班","便當","午餐","員購","公關","補貨","pos","群組","總控","負責人","聯絡人"])))return {found:true,blocked:true,type:"internal",answer:K.internal_guardrails.response};
 var ips=K.ip_locations.map(function(x){return {x:x,s:scoreNames(q,[x.ip].concat(x.aliases||[]))};}).sort(function(a,b){return b.s-a.s;});
 var zones=K.zones.map(function(z){return {z:z,s:scoreNames(q,[z.name].concat(z.aliases||[]))};}).sort(function(a,b){return b.s-a.s;});
 if(zones[0]&&zones[0].s>=8&&zones[0].z.id==="selected"&&has(q,["一番賞"])) return {found:true,type:"zone_contents",answer:"有。精選商品／一番賞區位於木棉花攤位外圍，不必排主攤位即可前往；一番賞品項與剩餘抽數請以現場為準。"};
 if(it==="contents"&&ips[0]&&ips[0].s>=12){
   var canon=ips[0].x.ip, aliases=[canon].concat(ips[0].x.aliases||[]).map(n);
   var ipps=K.products.filter(function(p){var pn=n(p.ip||"");return pn&&aliases.some(function(a){return pn===a||pn.indexOf(a)!==-1||a.indexOf(pn)!==-1;});});
   var msg=canon+"主攤位商品規劃在"+ips[0].x.counter+"號櫃附近";
   if(ipps.length) msg+="；另外資料中明確列出的商品有："+ipps.map(function(p){return p.name+(p.price!=null?"（"+money(p.price)+"）":"");}).join("、");
   msg+="。商品與即時庫存以現場為準。";
   return {found:true,type:"ip_contents",answer:msg,entry:ips[0].x,products:ipps};
 }
 if(zones[0]&&zones[0].s>=8&&it==="contents"&&(!ips[0]||ips[0].s<12)){
   if(zones[0].z.id==="selected"&&has(q,["一番賞"])) return {found:true,type:"zone_contents",answer:"有。精選商品／一番賞區位於木棉花攤位外圍，不必排主攤位即可前往；一番賞品項與剩餘抽數請以現場為準。"};
   var zid=zones[0].z.id, ps=K.products.filter(function(p){return p.zone===zid;});
   if(zid==="selected") return {found:true,type:"zone_contents",answer:"精選區目前資料包含：芙莉蓮造型悠遊卡系列、鬼滅之刃手錶、HUNTER×HUNTER黃金獵人執照、轉生史萊姆懶人墊，以及現貨展示的鬼滅／膽大黨／進擊的巨人手錶、芙莉蓮／進擊的巨人／鬼滅香氛、鬼滅金屬海報與膽大黨玻璃滑鼠墊等。部分為預購、部分為現貨，庫存以現場為準。家庭教師彭哥列戒指收藏組不在精選區。"};
   if(ps.length) return {found:true,type:"zone_contents",answer:zones[0].z.name+"已知品項包括："+ps.map(function(p){return (p.ip?p.ip+" ":"")+p.name+(p.price!=null?"（"+money(p.price)+"）":"");}).join("、")+"。即時庫存請以現場為準。"};
 }
 if(zones[0]&&zones[0].s>=8&&it==="price"&&(!ips[0]||ips[0].s<12)){
   var zid2=zones[0].z.id, ps2=K.products.filter(function(p){return p.zone===zid2;});
   if(zid2==="lucky_bag") return {found:true,type:"zone_price",answer:"福袋共有兩種價位：葬送的芙莉蓮、戀上換裝娃娃、膽大黨每袋NT$1,300；進擊的巨人、黃泉使者、莉可麗絲每袋NT$1,000。售完為止。"};
   if(zid2==="movie") return {found:true,type:"zone_price",answer:"指定電影單人票原價NT$250／張；任選4張每張NT$240，任選5張每張NT$225，可混搭不同電影。"};
   if(zid2==="machine") return {found:true,type:"zone_price",answer:"機台主要有一次NT$50的相卡／抽卡機，以及一次NT$100的載具卡片機。出卡張數依機台種類不同。"};
   if(zid2==="selected") return {found:true,type:"zone_price",answer:"精選區商品價格依品項不同，目前資料從NT$790到NT$4,600不等；請告訴我作品或商品名稱，我可以查更精確的價格。"};
   if(ps2.length) return {found:true,type:"zone_price",answer:ps2.map(function(p){return (p.ip?p.ip+" ":"")+p.name+(p.price!=null?"："+money(p.price):"：現場標價");}).join("；")+"。"};
 }
 var products=K.products.map(function(p){return {p:p,s:scoreNames(q,[p.name,p.ip].concat(p.aliases||[],p.variants||[]))};}).sort(function(a,b){return b.s-a.s;});
 if(products[0]&&products[0].s>=12)return withMedia({found:true,type:"product",score:products[0].s,product:products[0].p,answer:answerProduct(products[0].p,it),liveConfirmationRequired:!!products[0].p.live_confirmation_required},products[0].p.media_key);
 if(it==="location"&&ips[0]&&ips[0].s>=12)return withMedia({found:true,type:"ip_location",score:ips[0].s,answer:ips[0].x.answer,entry:ips[0].x},"booth_guide");
 var pol=K.policies.map(function(p){return {p:p,s:scoreNames(q,[p.topic].concat(p.question_patterns||[]))};}).sort(function(a,b){return b.s-a.s;});
 if(pol[0]&&pol[0].s>=10)return {found:true,type:"policy",score:pol[0].s,answer:pol[0].p.answer_full,entry:pol[0].p};
 if(zones[0]&&zones[0].s>=12){var z=zones[0].z;
   if(has(q,["文化幣"])) return {found:true,type:"zone_policy",answer:z.culture_points===true?z.name+"可以使用文化幣。":z.culture_points===false?z.name+"不可使用文化幣。":"這個區域不是消費付款區。"};
   if(has(q,["100元","折價券","大會券"])) return {found:true,type:"zone_policy",answer:z.coupon_100===true?z.name+"可以使用漫博100元折價券。":z.coupon_100===false?z.name+"不可使用漫博100元折價券。":"這個區域不適用折價券。"};
   if(has(q,["滿額贈","滿額"])) return {found:true,type:"zone_policy",answer:z.full_gift_eligible===true?z.name+"的當日單筆消費可列入滿額贈。":z.full_gift_eligible===false?z.name+"的消費不列入滿額贈。":"請依滿額贈櫃台規則辦理。"};
   if(has(q,["點數","紅利"])) return {found:true,type:"zone_policy",answer:z.muse_points===true?z.name+"的消費可在結帳時出示會員條碼累積點數。":z.muse_points===false?z.name+"的消費不列入木棉花樂園點數。":"這個區域不涉及會員點數。"};
   return {found:true,type:"zone",answer:z.location+" "+z.notes,entry:z};
 }
 var gifts=K.full_gifts.map(function(g){return {g:g,s:scoreNames(q,[g.name,String(g.threshold),g.level])};}).sort(function(a,b){return b.s-a.s;});
 if(gifts[0]&&gifts[0].s>=12){var g=gifts[0].g;return withMedia({found:true,type:"gift",answer:"消費滿NT$"+g.threshold.toLocaleString("zh-TW")+"可獲得「"+g.name+"」，領取處："+g.pickup+"。"+g.note+"。滿額贈採累贈制，且限當日單筆主攤位內消費。"},"full_gift_chart");}
 var acts=K.activities.map(function(a){return {a:a,s:scoreNames(q,[a.name].concat(a.aliases||[]))};}).sort(function(a,b){return b.s-a.s;});
 if(acts[0]&&acts[0].s>=10)return {found:true,type:"activity",score:acts[0].s,answer:acts[0].a.name+"："+acts[0].a.schedule+" "+acts[0].a.details,entry:acts[0].a,liveConfirmationRequired:true};
 var ranked=K.faq_entries.map(function(e){var s=scoreNames(q,[e.title].concat(e.example_questions||[],e.keywords||[]));return {e:e,s:s};}).sort(function(a,b){return b.s-a.s;});
 if(ranked[0]&&ranked[0].s>=8)return withMedia({found:true,type:"faq",score:ranked[0].s,answer:ranked[0].e.answer,entry:ranked[0].e,quickReplies:ranked[0].e.quick_replies||[],liveConfirmationRequired:!!ranked[0].e.live_confirmation_required},ranked[0].e.media_key);
 return {found:false,type:"fallback",answer:K.meta.fallback_answer,suggestions:ranked.slice(0,3).filter(function(x){return x.s>0;}).map(function(x){return x.e.title;})};
}
window.MUSE_CHATBOT_V2={normalize:n,findAnswer:findAnswer};
})();
