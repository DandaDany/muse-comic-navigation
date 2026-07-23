(() => {
  'use strict';
  const intents = [
    { keys:['文化幣','文化券','藝文'], answer:'文化幣可使用：場內商品、精選商品區。\n不可使用：福袋區、小舞台、電影票、機台區。\n文化幣不找零、不可換現金；紙本文化幣可以收。結帳時請先告知使用文化幣，並先掃木棉花文化幣 QR Code，再由收銀人員確認付款。' },
    { keys:['100元折價券','100 元折價券','折價券','優惠券'], answer:'漫博 25 周年 100 元折價券可使用於「場內商品」。\n不可使用於：精選商品區、福袋區、小舞台、電影票、機台區。\n不限單筆使用張數、沒有最低消費門檻，不找零、不可換現金；若退貨，折價券需退還。' },
    { keys:['付款','支付','刷卡','現金','apple pay','google pay','samsung pay'], answer:'付款方式包含信用卡、Apple Pay、Google Pay、Samsung Pay 與現金。現金消費 200 元以下請以現金為主。文化幣與漫博 100 元折價券有指定不可使用區域，請先確認商品所在區域。' },
    { keys:['滿額','滿額贈','贈品','550','1399','2499','3999','6699','8999'], answer:'展場限定滿額贈共有 6 級，依「當日單筆」木棉花攤位內的銷售明細計算：\nA 滿 550 元：無職轉生～到了異世界就拿出真本事～超大紙袋\nB 滿 1399 元：關於我轉生成史萊姆這檔事／絨毛吊飾（特典袋）A 款\nC 滿 2499 元：HUNTER×HUNTER 帆布袋 A 款\nD 滿 3999 元：86－不存在的戰區－長型不鏽鋼杯 A 款\nE 滿 6699 元：膽大黨舒壓袋回彈 A 款\nF 滿 8999 元：戀上換裝娃娃光碟線多功能電器 A 款\n福袋、精選商品、電影票、一番賞不列入滿額贈；滿額贈不可累計不同筆消費，數量有限送完為止。' },
    { keys:['福袋','盲袋','線上福袋','宅配','超取'], answer:'線上動漫節福袋開賣時間為 7/23 10:00。配送以商品頁顯示為準，可能有宅配或部分商品可超商寄送。木棉花樂園：國內超取運費 65 元、宅配 100 元、宅配貨到付款 150 元；木棉花蝦皮：國內超取運費 60 元，依平台公告為準。線上福袋含紙袋，紙袋凹折不算瑕疵，也不接受退換貨；福袋運費另計且不參加免運活動。' },
    { keys:['電影','電影票','單人票','影城'], answer:'電影區不可使用文化幣。指定電影單人票原價 250 元：任選 4 張可享 96 折，每張 240 元；任選 5 張可享 9 折，每張 225 元，且可混搭不同 IP。片單包含《攻殼機動隊（1995）4K 數位修復版》、《劇場版 魔法少女小圓〔瓦爾普吉斯的迴天〕》、《劇場版 Love Live! 蓮之空女學院學園偶像俱樂部 Bloom Garden Party》、《劇場版 鋼之鍊金術師 香巴拉的征服者》、《劇場版 鋼之鍊金術師 嘆息之丘的聖星》、《加速世界 劇場版 INFINITE BURST》。' },
    { keys:['機台','抽卡機','相卡機','載具卡片','卡片機'], answer:'機台區不可使用文化幣與漫博 100 元折價券。\n機台區 1：相卡機一次 50 元出 1 張（JOJO II A、家庭教師 C、魔法少女小圓 A）；抽卡機一次 50 元出 2 張（葬送的芙莉蓮 A）；載具卡片機一次 100 元出 1 張（進擊的巨人 A）。載具卡片機共 2 台，客人需持兌換券，另向工作人員索取吊飾掛勾與保護套。\n機台區 2：抽卡機一次 50 元出 1 張；抽卡機一次 50 元出 2 張，品項依現場機台標示。' },
    { keys:['預購','戒指','家庭教師','彭哥列'], answer:'家庭教師「彭哥列戒指收藏組」預購價 3,500 元／組，預計 11 月中旬依訂單順序陸續出貨。流程：掃 QR Code → 填寫訂購資訊 → 至精選區收銀台付款 → 完成訂單 → 後續宅配到府。填完訂購單不代表預購成功，需完成付款才會保留數量；預購商品皆使用 QR Code 填單，運費另計 100 元，限寄送台灣地區。' },
    { keys:['獵人','hunter','HUNTER','執照','典藏組'], answer:'《HUNTER×HUNTER》黃金獵人執照 A 款典藏組預購價 4,600 元／款，預計 12 月下旬依訂單順序陸續出貨。流程：掃 QR Code → 填寫訂購資訊 → 至精選區收銀台付款 → 完成訂單 → 後續宅配到府。填單不代表預購成功，需付款才會保留數量；預購商品運費另計 100 元，限寄送台灣地區。' },
    { keys:['精選','精選商品','一番賞','手錶','香水','外圍'], answer:'精選商品區位於展場外圍，不用進入木棉花攤位即可購買，數量有限、售完為止。精選商品區可使用文化幣，但不可使用漫博 100 元折價券；精選商品、一番賞、電影票與福袋不列入展場滿額贈。預購商品請依現場 QR Code 填單並至精選區收銀台付款。' },
    { keys:['在哪','位置','櫃位','攤位','怎麼走','導航','路線'], answer:'我可以協助你找木棉花攤位與展場外圍區域。請使用下方導航功能，輸入目前面向走道時左右兩側看到的品牌；如果人在入口，也可以切換「入口導航」。外圍的福袋、精選、電影、小舞台、收銀與滿額贈位置，請依展場配置圖及現場指示牌為準。' },
    { keys:['營業','開賣','時間','幾點'], answer:'目前資料確認：線上動漫節福袋開賣時間為 7/23 10:00。展場各區實際開放與銷售時間仍請以主辦單位及現場公告為準。' }
  ];
  const normalize = (value) => value.toLowerCase().replace(/[\s　！？。，、；：:,.!?]/g, '');
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const addMessage = (box, text, type) => { const item=document.createElement('div'); item.className=`service-msg ${type}`; item.innerHTML=escapeHtml(text).replace(/QR Code/g,'<strong>QR Code</strong>'); box.appendChild(item); box.scrollTop=box.scrollHeight; };
  const answer = (question) => {
    const q=normalize(question); if(!q) return '請輸入你想詢問的主題，例如：文化幣、滿額贈、電影票、機台、福袋或預購。';
    const ranked=intents.map((intent)=>({intent,score:intent.keys.reduce((n,key)=>n+(q.includes(normalize(key))?normalize(key).length+2:0),0)})).sort((a,b)=>b.score-a.score);
    return ranked[0].score ? ranked[0].intent.answer : '我目前還找不到完全對應的答案。你可以改問「文化幣能不能用」、「滿額贈怎麼算」、「電影票優惠」、「機台怎麼玩」、「福袋怎麼配送」或「預購流程」；若是商品位置，請使用下方導航功能。';
  };
  const create = () => {
    const launcher=document.createElement('button'); launcher.className='service-launcher'; launcher.type='button'; launcher.setAttribute('aria-label','開啟客服機器人'); launcher.textContent='問';
    const panel=document.createElement('section'); panel.className='service-panel'; panel.setAttribute('aria-label','木棉花客服機器人');
    panel.innerHTML='<div class="service-head"><strong>木棉花客服小幫手</strong><button class="service-close" type="button" aria-label="關閉">×</button></div><div class="service-messages" aria-live="polite"></div><div class="service-quick"><button type="button">付款方式</button><button type="button">文化幣</button><button type="button">滿額贈</button><button type="button">電影票</button><button type="button">機台規則</button></div><form class="service-form"><input aria-label="輸入問題" placeholder="例如：文化幣可以買福袋嗎？"><button type="submit">送出</button></form>';
    document.body.append(launcher,panel); const messages=panel.querySelector('.service-messages'), input=panel.querySelector('input');
    const submit=(question)=>{if(!question.trim())return;addMessage(messages,question,'user');input.value='';window.setTimeout(()=>addMessage(messages,answer(question),'bot'),120);};
    launcher.addEventListener('click',()=>{panel.classList.toggle('open');if(panel.classList.contains('open')&&!messages.children.length)addMessage(messages,'你好！我可以回答付款、文化幣、折價券、滿額贈、福袋、電影票、機台、精選商品與預購流程。','bot');if(panel.classList.contains('open'))input.focus();});
    panel.querySelector('.service-close').addEventListener('click',()=>panel.classList.remove('open'));
    panel.querySelector('.service-form').addEventListener('submit',(event)=>{event.preventDefault();submit(input.value);});
    panel.querySelectorAll('.service-quick button').forEach((button)=>button.addEventListener('click',()=>submit(button.textContent)));
  };
  if(document.body)create();else document.addEventListener('DOMContentLoaded',create,{once:true});
})();
