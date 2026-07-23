(() => {
  'use strict';

  const normalize = (text) => String(text || '').normalize('NFKC').toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）【】\[\]「」『』\-—_]/g, '');
  const setRuntimeCorrections = () => {
    const kb = window.MUSE_CONSUMER_KB;
    if (!kb || kb.__consumerCorrectionsApplied) return Boolean(kb);
    kb.__consumerCorrectionsApplied = true;
    Object.values(kb.media_assets || {}).forEach((media) => {
      if (media && media.src) media.src = `assets/chatbot-media/${media.src.split('/').pop()}`;
    });
    const vongola = (kb.products || []).find((product) => product.id === 'sel_reborn_ring');
    if (vongola) {
      vongola.zone = 'selected';
      vongola.name = '彭哥列戒指收藏組';
      vongola.aliases = ['彭哥列戒指收藏組', '彭哥列戒指', '戒指收藏組'];
      vongola.details = ['精選商品區預購商品', '掃描 QR Code 填寫訂購資料，再到精選區收銀台付款', '單筆運費 100 元，預計 2026 年 11 月中旬依訂單順序出貨'];
    }
    if (!(kb.products || []).some((product) => product.id === 'booth_reborn_sky_ring')) {
      kb.products.push({ id:'booth_reborn_sky_ring', zone:'main_booth', ip:'家庭教師HITMAN REBORN!', name:'家庭教師大空戒', aliases:['家庭教師戒指', '家教戒指', '大空戒'], price:null, price_note:'價格請以場內櫃位標示為準', sale_type:'場內商品', variants:[], shipping:null, availability:'請依現場庫存為準', details:['位於主攤位場內，6 號櫃附近'], media_key:'booth_guide' });
    }
    (kb.faq_entries || []).forEach((entry) => {
      if (['selected_area_products', 'selected_products_detailed'].includes(entry.id)) entry.answer = '精選商品區有預購、現貨宅配、現貨展示與一番賞商品，包括芙莉蓮造型悠遊卡系列、鬼滅之刃手錶、HUNTER×HUNTER 黃金獵人執照、家庭教師彭哥列戒指收藏組、轉生史萊姆懶人墊，以及鬼滅／膽大黨／進擊的巨人手錶、三個 IP 的香氛商品、鬼滅金屬海報與膽大黨玻璃滑鼠墊。';
      if (entry.id === 'reborn_ring_location') entry.answer = '家庭教師戒指有兩項商品：彭哥列戒指收藏組在精選商品區；家庭教師大空戒在主攤位場內 6 號櫃附近。';
    });
    return true;
  };

  const isFamilyRingQuestion = (question) => {
    const q = normalize(question);
    return (q.includes('家庭教師') || q.includes('家教') || q.includes('reborn')) && (q.includes('戒') || q.includes('ring'));
  };
  const familyRingAnswer = () => ({
    answer:'家庭教師戒指共有兩項，請留意位置不同：\n\n1. 彭哥列戒指收藏組：精選商品區預購，NT$3,500／組。掃 QR Code 填寫資料後，到精選區收銀台付款；單筆運費 100 元，預計 2026 年 11 月中旬依訂單順序出貨。\n\n2. 家庭教師大空戒：主攤位場內，6 號櫃附近。價格與庫存請以現場櫃位標示為準。', media: window.MUSE_CONSUMER_KB.media_assets.reborn_preorder_flow
  });
  const zoneAnswer = () => ({
    answer:'木棉花共有 7 個區域：\n• 主攤位商品區：場內商品與各 IP 櫃位，需依排隊機制入場。\n• 精選商品／一番賞區：外圍，可直接前往。\n• 福袋區：外圍，可直接購買。\n• 電影票區：外圍，可直接購買。\n• 機台區：位於攤位對面。\n• 小舞台：外圍，進行福袋販售與拍賣。\n• 滿額贈櫃台：外圍，憑符合資格的主攤位單筆明細兌換。', media: window.MUSE_CONSUMER_KB.media_assets.external_area_layout
  });
  const selectedAnswer = () => ({
    answer:'精選商品區位於木棉花攤位外圍，不必排主攤位入場。\n\n這裡有預購、現貨宅配、現貨展示與一番賞：芙莉蓮造型悠遊卡系列、鬼滅之刃手錶、HUNTER×HUNTER 黃金獵人執照、家庭教師彭哥列戒指收藏組、轉生史萊姆懶人墊、鬼滅／膽大黨／進擊的巨人手錶、香氛、鬼滅金屬海報與膽大黨玻璃滑鼠墊。\n\n精選商品區可用文化幣；不可用漫博 100 元折價券，也不列入滿額贈。'
  });

  const install = () => {
    if (document.querySelector('.consumer-chatbot') || !setRuntimeCorrections() || !window.MUSE_CHATBOT_V2) return;
    const chat = document.getElementById('chat');
    const navForm = document.getElementById('navForm');
    if (!chat || !navForm) return;
    document.body.classList.add('consumer-mode');
    const box = document.createElement('section');
    box.className = 'consumer-chatbot';
    box.innerHTML = `<h1>木棉花客服小幫手</h1><p class="intro">輸入商品、優惠、付款、預購或區域問題；需要帶路時，再開啟攤位導航。</p><div class="consumer-quick"><button type="button" data-action="navigate">我怎麼去木棉花攤位</button><button type="button" data-action="selected">精選區有賣什麼？</button><button type="button" data-action="zones">木棉花有哪些區域？</button></div><form class="consumer-form"><input aria-label="輸入客服問題" placeholder="例如：家庭教師戒指在哪裡？" autocomplete="off"><button type="submit">詢問</button></form><div class="consumer-nav-note">已開啟攤位導航。請在下方輸入你目前面向走道時的左右品牌，或切換成入口導航。</div><div class="consumer-messages" aria-live="polite"></div>`;
    chat.prepend(box);
    const messages = box.querySelector('.consumer-messages');
    const input = box.querySelector('input');
    const render = (text, role, media) => {
      const item = document.createElement('article'); item.className = `consumer-message ${role}`; item.textContent = text; messages.appendChild(item);
      if (media && media.src) { const image = document.createElement('img'); image.className = 'consumer-media'; image.src = media.src; image.alt = media.alt || ''; image.loading = 'lazy'; item.appendChild(image); }
      item.scrollIntoView({ behavior:'smooth', block:'nearest' });
    };
    const ask = (question) => {
      const text = question.trim(); if (!text) return; document.body.classList.remove('consumer-navigation-open'); render(text, 'user'); input.value = '';
      let result;
      if (isFamilyRingQuestion(text)) result = familyRingAnswer();
      else if (text === '精選區有賣什麼？') result = selectedAnswer();
      else if (text === '木棉花有哪些區域？') result = zoneAnswer();
      else result = window.MUSE_CHATBOT_V2.findAnswer(text);
      render(result.answer || '目前找不到對應答案，請換個方式詢問。', 'bot', result.media);
    };
    box.querySelector('.consumer-form').addEventListener('submit', (event) => { event.preventDefault(); ask(input.value); });
    box.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'navigate') { document.body.classList.add('consumer-navigation-open'); navForm.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      ask(action === 'selected' ? '精選區有賣什麼？' : '木棉花有哪些區域？');
    }));
    render('你好！想知道商品、付款、文化幣、折價券、滿額贈、預購或區域資訊，都可以直接問我。', 'bot');
  };

  const observeApp = new MutationObserver(() => {
    const appRun = [...document.scripts].find((script) => script.src.endsWith('/js/app-run.js'));
    if (appRun) { appRun.addEventListener('load', install, { once:true }); observeApp.disconnect(); }
  });
  observeApp.observe(document.documentElement, { childList:true, subtree:true });
  window.setTimeout(install, 2500);
})();
