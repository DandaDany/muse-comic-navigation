(() => {
  "use strict";

  const payload = window.EXPO_DATA;
  if (!payload) throw new Error("離線資料未載入");

  const { navigation: DATA, vendors, meta } = payload;
  const MAP_W = 1600;
  const MAP_H = 1751;
  const MAP_URL = "assets/map.webp";
  const corridors = DATA.corridors;
  const faces = DATA.faces;
  const entrances = DATA.entrances;
  const brands = DATA.brands;
  const majorLandmarks = new Set(DATA.majorLandmarks || []);
  const turnWords = { straight: "直走", left: "向左轉", right: "向右轉", back: "向後轉" };

  const state = {
    destinationMode: "ip",
    positionMode: "entrance",
    destination: null,
    lastEditedSide: "left",
    currentRoute: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[ch]);
  const escapeXml = escapeHtml;
  const norm = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[^0-9a-z\u3040-\u30ff\u3400-\u9fff\uff65-\uff9f]+/g, "");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pointAt = (corridor, t) => [
    corridor.a[0] + (corridor.b[0] - corridor.a[0]) * t,
    corridor.a[1] + (corridor.b[1] - corridor.a[1]) * t,
  ];
  const projectT = (corridor, point) => {
    const dx = corridor.b[0] - corridor.a[0];
    const dy = corridor.b[1] - corridor.a[1];
    return ((point[0] - corridor.a[0]) * dx + (point[1] - corridor.a[1]) * dy) / (dx * dx + dy * dy);
  };
  const segmentLength = (corridor) => dist(corridor.a, corridor.b);
  const angleBetween = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const normalizeAngle = (angle) => {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  };
  const turnKind = (from, to) => {
    const delta = normalizeAngle(to - from);
    const abs = Math.abs(delta);
    if (abs < Math.PI / 7) return "straight";
    if (abs > Math.PI * 5 / 6) return "back";
    return delta > 0 ? "right" : "left";
  };

  const aliasToLabel = new Map();
  const labelsToAliases = new Map();
  for (const brand of brands) {
    const aliases = [brand.label, ...(brand.aliases || [])];
    labelsToAliases.set(brand.label, aliases);
    for (const alias of aliases) aliasToLabel.set(norm(alias), brand.label);
  }

  function resolveBrand(value) {
    const query = norm(value);
    if (!query) return null;
    if (aliasToLabel.has(query)) return aliasToLabel.get(query);
    const matches = new Set();
    for (const [alias, label] of aliasToLabel) {
      if (alias.includes(query) || query.includes(alias)) matches.add(label);
    }
    return matches.size === 1 ? [...matches][0] : null;
  }

  function searchScore(value, query) {
    const text = norm(value);
    if (!text) return 99;
    if (!query) return 4;
    if (text === query) return 0;
    if (text.startsWith(query)) return 1;
    if (text.includes(query)) return 2;
    if (query.includes(text)) return 3;
    return 99;
  }

  function matchesFor(value, allowedLabels = null) {
    const query = norm(value);
    const allowed = allowedLabels ? new Set(allowedLabels) : null;
    return brands
      .filter((brand) => !allowed || allowed.has(brand.label))
      .map((brand) => ({
        label: brand.label,
        score: Math.min(...[brand.label, ...(brand.aliases || [])].map((alias) => searchScore(alias, query))),
      }))
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "zh-Hant"))
      .slice(0, allowed ? 40 : 18)
      .map((item) => item.label);
  }

  const facesByBrand = new Map();
  for (const face of faces) {
    if (!facesByBrand.has(face.brand)) facesByBrand.set(face.brand, []);
    facesByBrand.get(face.brand).push(face);
  }

  function locatePair(right, left) {
    const rightFaces = facesByBrand.get(right) || [];
    const leftFaces = facesByBrand.get(left) || [];
    const candidates = [];
    for (const r of rightFaces) for (const l of leftFaces) {
      if (r.corridor !== l.corridor || r.side === l.side) continue;
      const corridor = corridors[r.corridor];
      const length = segmentLength(corridor);
      const lo = Math.max(r.t0, l.t0);
      const hi = Math.min(r.t1, l.t1);
      let t;
      let gapPx;
      if (lo <= hi) {
        t = (lo + hi) / 2;
        gapPx = 0;
      } else {
        const gap = r.t1 < l.t0 ? [r.t1, l.t0] : [l.t1, r.t0];
        t = (gap[0] + gap[1]) / 2;
        gapPx = Math.abs(gap[1] - gap[0]) * length;
      }
      const canonical = r.side === "right" && l.side === "left";
      const heading = angleBetween(corridor.a, corridor.b) + (canonical ? 0 : Math.PI);
      const qualityPenalty = (r.quality === "exact" ? 0 : 18) + (l.quality === "exact" ? 0 : 18);
      candidates.push({
        corridor: r.corridor,
        t: clamp(t, 0, 1),
        point: pointAt(corridor, clamp(t, 0, 1)),
        heading: normalizeAngle(heading),
        gapPx,
        score: gapPx + qualityPenalty,
        rFace: r,
        lFace: l,
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    if (!candidates.length || candidates[0].gapPx > 360) return null;
    const best = candidates[0];
    const exact = best.rFace.quality === "exact" && best.lFace.quality === "exact";
    best.confidence = exact && best.gapPx < 25 ? "高" : best.gapPx < 130 && best.score < 80 ? "中" : "推估";
    return best;
  }

  const compatibilityCache = new Map();
  function compatibilityOptions(known, knownSide) {
    const canonical = resolveBrand(known) || known;
    if (!canonical || !facesByBrand.has(canonical)) return [];
    const key = `${knownSide}|${canonical}`;
    if (compatibilityCache.has(key)) return compatibilityCache.get(key);
    const items = [];
    for (const brand of brands) {
      if (brand.label === canonical) continue;
      const match = knownSide === "right"
        ? locatePair(canonical, brand.label)
        : locatePair(brand.label, canonical);
      if (!match) continue;
      items.push({ label: brand.label, score: match.score, confidence: match.confidence });
    }
    items.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "zh-Hant"));
    compatibilityCache.set(key, items);
    return items;
  }

  function lineIntersection(c1, c2) {
    const p = c1.a;
    const r = [c1.b[0] - c1.a[0], c1.b[1] - c1.a[1]];
    const q = c2.a;
    const s = [c2.b[0] - c2.a[0], c2.b[1] - c2.a[1]];
    const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
    const rxs = cross(r, s);
    if (Math.abs(rxs) < 1e-8) return null;
    const qp = [q[0] - p[0], q[1] - p[1]];
    const t = cross(qp, s) / rxs;
    const u = cross(qp, r) / rxs;
    if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
    return { t1: clamp(t, 0, 1), t2: clamp(u, 0, 1) };
  }

  const corridorIds = Object.keys(corridors);
  const baseSplitTs = new Map(corridorIds.map((id) => [id, [0, 1]]));
  for (let i = 0; i < corridorIds.length; i += 1) for (let j = i + 1; j < corridorIds.length; j += 1) {
    const hit = lineIntersection(corridors[corridorIds[i]], corridors[corridorIds[j]]);
    if (!hit) continue;
    baseSplitTs.get(corridorIds[i]).push(hit.t1);
    baseSplitTs.get(corridorIds[j]).push(hit.t2);
  }

  function shortestPath(startPoint, startCorridor, targetPoint, targetCorridor) {
    const splitTs = new Map([...baseSplitTs].map(([id, values]) => [id, [...values]]));
    splitTs.get(startCorridor).push(clamp(projectT(corridors[startCorridor], startPoint), 0, 1));
    splitTs.get(targetCorridor).push(clamp(projectT(corridors[targetCorridor], targetPoint), 0, 1));

    const nodes = [];
    const nodeIndex = new Map();
    const adjacency = [];
    const nodeKey = (point) => `${Math.round(point[0] * 100) / 100},${Math.round(point[1] * 100) / 100}`;
    const getNode = (point) => {
      const key = nodeKey(point);
      if (nodeIndex.has(key)) return nodeIndex.get(key);
      const id = nodes.length;
      nodes.push([point[0], point[1]]);
      nodeIndex.set(key, id);
      adjacency.push([]);
      return id;
    };

    for (const id of corridorIds) {
      const corridor = corridors[id];
      const ts = [...new Set(splitTs.get(id).map((t) => Math.round(clamp(t, 0, 1) * 1e6) / 1e6))]
        .sort((a, b) => a - b);
      const rows = ts.map((t) => ({ t, point: pointAt(corridor, t) }));
      for (const row of rows) row.node = getNode(row.point);
      for (let i = 0; i < rows.length - 1; i += 1) {
        const a = rows[i];
        const b = rows[i + 1];
        const weight = dist(a.point, b.point);
        adjacency[a.node].push({ to: b.node, weight, corridor: id });
        adjacency[b.node].push({ to: a.node, weight, corridor: id });
      }
    }

    const startNode = nodeIndex.get(nodeKey(startPoint));
    const targetNode = nodeIndex.get(nodeKey(targetPoint));
    if (startNode == null || targetNode == null) return null;

    const distances = Array(nodes.length).fill(Infinity);
    const previous = Array(nodes.length).fill(null);
    const used = Array(nodes.length).fill(false);
    distances[startNode] = 0;
    for (let iteration = 0; iteration < nodes.length; iteration += 1) {
      let current = -1;
      let best = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        if (!used[i] && distances[i] < best) {
          current = i;
          best = distances[i];
        }
      }
      if (current < 0 || current === targetNode) break;
      used[current] = true;
      for (const edge of adjacency[current]) {
        const nextDistance = distances[current] + edge.weight;
        if (nextDistance < distances[edge.to] - 1e-7) {
          distances[edge.to] = nextDistance;
          previous[edge.to] = { from: current, corridor: edge.corridor };
        }
      }
    }
    if (!Number.isFinite(distances[targetNode])) return null;

    const reversed = [];
    let current = targetNode;
    while (current != null) {
      reversed.push(current);
      if (current === startNode) break;
      current = previous[current]?.from;
    }
    reversed.reverse();
    const legs = [];
    for (let i = 1; i < reversed.length; i += 1) {
      const fromNode = reversed[i - 1];
      const toNode = reversed[i];
      legs.push({
        from: [...nodes[fromNode]],
        to: [...nodes[toNode]],
        corridor: previous[toNode].corridor,
      });
    }
    return { distance: distances[targetNode], legs, points: reversed.map((id) => [...nodes[id]]) };
  }

  function boothPoint(face) {
    const corridor = corridors[face.corridor];
    const aisle = pointAt(corridor, (face.t0 + face.t1) / 2);
    const dx = corridor.b[0] - corridor.a[0];
    const dy = corridor.b[1] - corridor.a[1];
    const length = Math.hypot(dx, dy) || 1;
    const normal = face.side === "right" ? [-dy / length, dx / length] : [dy / length, -dx / length];
    const offset = face.quality === "joint-area" ? 48 : 68;
    return [clamp(aisle[0] + normal[0] * offset, 20, MAP_W - 20), clamp(aisle[1] + normal[1] * offset, 20, MAP_H - 20)];
  }

  function actualSidesForLeg(leg) {
    const corridor = corridors[leg.corridor];
    const t0 = projectT(corridor, leg.from);
    const t1 = projectT(corridor, leg.to);
    const forward = t1 >= t0;
    const min = Math.min(t0, t1) - 1e-6;
    const max = Math.max(t0, t1) + 1e-6;
    const result = { left: [], right: [] };
    for (const face of faces) {
      if (face.corridor !== leg.corridor || face.t1 < min || face.t0 > max) continue;
      const actual = forward ? face.side : face.side === "left" ? "right" : "left";
      const t = (Math.max(min, face.t0) + Math.min(max, face.t1)) / 2;
      result[actual].push({ label: face.brand, t });
    }
    const direction = forward ? 1 : -1;
    for (const side of ["left", "right"]) {
      result[side].sort((a, b) => (a.t - b.t) * direction);
      const seen = new Set();
      const unique = result[side].filter((item) => !seen.has(item.label) && seen.add(item.label));
      const majors = unique.filter((item) => majorLandmarks.has(item.label));
      result[side] = (majors.length ? majors : unique).slice(0, 4).map((item) => item.label);
    }
    return result;
  }

  function cueAt(point) {
    const exact = `${Math.round(point[0])},${Math.round(point[1])}`;
    if (DATA.nodeCues[exact]) return DATA.nodeCues[exact];
    let best = null;
    let bestDistance = 55;
    for (const [key, text] of Object.entries(DATA.nodeCues)) {
      const distance = dist(point, key.split(",").map(Number));
      if (distance < bestDistance) {
        best = text;
        bestDistance = distance;
      }
    }
    return best || "下一個主要路口";
  }

  function mergeLegs(legs) {
    const groups = [];
    for (const leg of legs) {
      const angle = angleBetween(leg.from, leg.to);
      const last = groups.at(-1);
      if (last && last.corridor === leg.corridor && Math.abs(normalizeAngle(last.angle - angle)) < 0.05) {
        last.to = leg.to;
        last.angle = angle;
      } else {
        groups.push({ ...leg, angle });
      }
    }
    return groups;
  }

  function brandPhrase(items) {
    if (!items.length) return "";
    return items.map((item) => `「${item}」`).join("、") + (items.length >= 4 ? "等攤位" : "");
  }

  function movementSentence(group, exclude = new Set()) {
    const sides = actualSidesForLeg(group);
    sides.left = sides.left.filter((item) => !exclude.has(item));
    sides.right = sides.right.filter((item) => !exclude.has(item));
    const left = brandPhrase(sides.left);
    const right = brandPhrase(sides.right);
    let text = "沿走道直走。";
    if (left && right) text += `途中左手邊會經過 ${left}；右手邊會經過 ${right}。`;
    else if (left) text += `途中左手邊會經過 ${left}。`;
    else if (right) text += `途中右手邊會經過 ${right}。`;
    return text;
  }

  function routeToDestination(start) {
    if (!state.destination?.mapLabels?.length) return null;
    const targetCandidates = state.destination.mapLabels.flatMap((label) =>
      (facesByBrand.get(label) || []).map((face) => ({ label, face })),
    );
    let best = null;
    for (const candidate of targetCandidates) {
      const targetPoint = pointAt(corridors[candidate.face.corridor], (candidate.face.t0 + candidate.face.t1) / 2);
      const path = shortestPath(start.point, start.corridor, targetPoint, candidate.face.corridor);
      if (!path) continue;
      if (!best || path.distance < best.path.distance) best = { ...candidate, targetPoint, path };
    }
    if (!best) return null;

    const groups = mergeLegs(best.path.legs);
    const steps = [];
    const exclude = new Set([...start.startBrands, best.label]);
    if (groups.length) {
      const firstKind = turnKind(start.heading, groups[0].angle);
      const startAction = {
        straight: "請沿目前面向直走。",
        left: "請先向左轉，再沿紅線直走。",
        right: "請先向右轉，再沿紅線直走。",
        back: "請先向後轉，再沿紅線直走。",
      }[firstKind];
      steps.push(startAction + movementSentence(groups[0], exclude).replace(/^沿走道直走。/, ""));
      for (let i = 1; i < groups.length; i += 1) {
        const kind = turnKind(groups[i - 1].angle, groups[i].angle);
        steps.push(`走到「${cueAt(groups[i - 1].to)}」時${turnWords[kind]}。${movementSentence(groups[i], exclude)}`);
      }
    } else {
      steps.push("你已經在目的地前方的走道，請查看地圖上的終點標記。");
    }

    const destinationBoothPoint = boothPoint(best.face);
    const finalLeg = groups.at(-1);
    let side = "旁邊";
    if (finalLeg) {
      const direction = [finalLeg.to[0] - finalLeg.from[0], finalLeg.to[1] - finalLeg.from[1]];
      const towardBooth = [destinationBoothPoint[0] - finalLeg.to[0], destinationBoothPoint[1] - finalLeg.to[1]];
      const cross = direction[0] * towardBooth[1] - direction[1] * towardBooth[0];
      side = cross > 0 ? "右手邊" : cross < 0 ? "左手邊" : "正前方";
    }
    steps.push(`紅線終點${side}的「${state.destination.name}」就是目的地。`);

    const firstKind = groups.length ? turnKind(start.heading, groups[0].angle) : "straight";
    const orientation = {
      straight: "你目前的面向正確，可以直接前進。",
      left: "先以你的角度向左轉。",
      right: "先以你的角度向右轉。",
      back: "你目前背對推薦方向，請先向後轉。",
    }[firstKind];

    return {
      title: `前往${state.destination.name}的最快路線`,
      where: start.where,
      confidence: start.confidence,
      orientation,
      steps,
      start: start.point,
      heading: start.heading,
      path: best.path.points,
      distance: best.path.distance,
      boothPoint: destinationBoothPoint,
      targetMapLabel: best.label,
      destination: state.destination,
    };
  }

  const ipRecords = vendors.flatMap((vendor) => [
    ...vendor.ips.map((item) => ({ ...item, vendor, status: "sale" })),
    ...vendor.pendingIps.map((item) => ({ ...item, vendor, status: "pending" })),
  ]);
  const vendorDestinations = vendors.map((vendor) => ({
    key: `vendor:${vendor.id}`,
    name: vendor.name,
    type: "vendor",
    vendor,
    mapLabels: vendor.mapLabels,
    locationStatus: vendor.locationStatus,
    aliases: [vendor.name, ...vendor.mapLabels],
  }));
  const mapDestinations = brands.map((brand) => ({
    key: `map:${brand.label}`,
    name: brand.label,
    type: "map",
    mapLabels: [brand.label],
    locationStatus: facesByBrand.has(brand.label) ? "mapped" : "unconfirmed",
    aliases: [brand.label, ...(brand.aliases || [])],
  }));
  const allDestinations = [...vendorDestinations, ...mapDestinations];
  const destinationByKey = new Map(allDestinations.map((item) => [item.key, item]));

  function renderDataBadges() {
    $("#dataBadges").innerHTML = [
      `${meta.vendorCount} 個廠商群組`,
      `${meta.ipRecordCount} 筆販售 IP`,
      `${meta.pendingIpRecordCount} 筆待確認`,
      `${brands.length} 個可搜尋地標`,
    ].map((text) => `<span class="data-badge">${escapeHtml(text)}</span>`).join("");
  }

  function renderIpResults() {
    const query = norm($("#ipSearch").value);
    const featured = ["葬送的芙莉蓮", "排球少年", "進擊的巨人", "hololive", "咒術迴戰", "名偵探柯南"];
    let results;
    if (!query) {
      results = ipRecords.filter((record) => featured.some((term) => norm(record.name).includes(norm(term))));
    } else {
      results = ipRecords
        .map((record) => {
          const ipScore = searchScore(record.name, query);
          const vendorScore = searchScore(record.vendor.name, query) + 1;
          return { ...record, score: Math.min(ipScore, vendorScore) };
        })
        .filter((record) => record.score < 99)
        .sort((a, b) => a.score - b.score || (a.status === b.status ? 0 : a.status === "sale" ? -1 : 1) || a.name.localeCompare(b.name, "zh-Hant"));
    }
    const unique = [];
    const seen = new Set();
    for (const record of results) {
      const key = `${record.name}|${record.vendor.id}|${record.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(record);
      if (unique.length >= 40) break;
    }
    const container = $("#ipResults");
    if (!unique.length) {
      container.innerHTML = `<div class="empty-state">找不到符合的 IP。可縮短關鍵字，或改用「直接選目的地」。</div>`;
      return;
    }
    container.innerHTML = unique.map((record, index) => {
      const mapped = record.vendor.locationStatus === "mapped";
      const badge = !mapped
        ? `<span class="status-badge unmapped">位置待確認</span>`
        : record.status === "sale"
          ? `<span class="status-badge sale">明確販售</span>`
          : `<span class="status-badge pending">展示／待確認</span>`;
      return `<button class="result-button" type="button" data-ip-result="${index}">
        <span class="result-top"><span class="result-name">${escapeHtml(record.name)}</span>${badge}</span>
        <span class="result-vendor">${escapeHtml(record.vendor.name)}</span>
      </button>`;
    }).join("");
    container.querySelectorAll("[data-ip-result]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = unique[Number(button.dataset.ipResult)];
        setDestination({
          key: `ip:${record.vendor.id}:${record.name}`,
          name: record.vendor.name,
          type: "ip",
          ipName: record.name,
          ipStatus: record.status,
          vendor: record.vendor,
          mapLabels: record.vendor.mapLabels,
          locationStatus: record.vendor.locationStatus,
        });
      });
    });
  }

  function renderDestinationResults() {
    const query = norm($("#destinationSearch").value);
    const featured = new Set([
      "木棉花 MUSE", "曼迪傳播", "台灣角川", "青文出版", "東立出版", "尖端媒體集團",
      "買動漫", "日本主題館", "A舞台", "B舞台", "大會服務台", "廁所", "醫務室", "景觀電梯",
    ]);
    const results = allDestinations
      .map((destination) => ({
        destination,
        score: query
          ? Math.min(...destination.aliases.map((alias) => searchScore(alias, query)))
          : featured.has(destination.name) ? 0 : 4,
      }))
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || (a.destination.type === "vendor" ? -1 : 1) || a.destination.name.localeCompare(b.destination.name, "zh-Hant"));
    const unique = [];
    const seen = new Set();
    for (const item of results) {
      const duplicateKey = `${item.destination.name}|${item.destination.mapLabels.join("|")}`;
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      unique.push(item.destination);
      if (unique.length >= (query ? 45 : 14)) break;
    }
    const container = $("#destinationResults");
    if (!unique.length) {
      container.innerHTML = `<div class="empty-state">找不到符合的品牌或地標。請縮短關鍵字再試一次。</div>`;
      return;
    }
    container.innerHTML = unique.map((destination) => `
      <button class="result-button" type="button" data-destination-key="${escapeHtml(destination.key)}">
        <span class="result-top">
          <span class="result-name">${escapeHtml(destination.name)}</span>
          ${destination.locationStatus === "mapped" ? "" : '<span class="status-badge unmapped">位置待確認</span>'}
        </span>
        <span class="result-vendor">${destination.type === "vendor" ? "廠商／攤位資料" : "地圖品牌／設施"}</span>
      </button>`).join("");
    container.querySelectorAll("[data-destination-key]").forEach((button) => {
      button.addEventListener("click", () => setDestination(destinationByKey.get(button.dataset.destinationKey)));
    });
  }

  function setDestination(destination) {
    state.destination = destination;
    const selected = $("#selectedDestination");
    selected.classList.remove("hidden", "unconfirmed");
    if (destination.locationStatus !== "mapped") selected.classList.add("unconfirmed");
    const detail = destination.ipName
      ? `${destination.ipStatus === "sale" ? "明確販售" : "展示／販售待確認"}：${destination.ipName}`
      : destination.type === "vendor"
        ? `地圖定位：${destination.mapLabels.join("／") || "尚待確認"}`
        : "已從地圖品牌／地標選擇";
    selected.innerHTML = `
      <span class="eyebrow">已選擇目的地</span>
      <strong>${escapeHtml(destination.name)}</strong>
      <p>${escapeHtml(detail)}</p>
      <button class="remove-destination" id="removeDestination" type="button" aria-label="取消目的地">×</button>`;
    $("#removeDestination").addEventListener("click", clearDestination);
    selected.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearDestination() {
    state.destination = null;
    $("#selectedDestination").className = "selected-destination hidden";
    $("#selectedDestination").innerHTML = "";
  }

  function switchDestinationMode(mode) {
    state.destinationMode = mode;
    $$('[data-destination-mode]').forEach((button) => {
      const active = button.dataset.destinationMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#ipSearchPanel").classList.toggle("hidden", mode !== "ip");
    $("#directSearchPanel").classList.toggle("hidden", mode !== "direct");
  }

  function switchPositionMode(mode) {
    state.positionMode = mode;
    $$('[data-position-mode]').forEach((button) => {
      const active = button.dataset.positionMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#entrancePanel").classList.toggle("hidden", mode !== "entrance");
    $("#brandPositionPanel").classList.toggle("hidden", mode !== "brands");
    if (mode === "brands") renderCompatibility();
  }

  function sideInput(side) {
    return side === "right" ? $("#rightBrand") : $("#leftBrand");
  }

  function renderCompatibility() {
    const right = resolveBrand($("#rightBrand").value);
    const left = resolveBrand($("#leftBrand").value);
    const panel = $("#compatibilityPanel");
    panel.className = "compatibility hidden";
    panel.innerHTML = "";
    if (right && left) {
      const match = locatePair(right, left);
      panel.classList.remove("hidden");
      if (match) {
        panel.classList.add("success");
        panel.innerHTML = `✓ 這組左右品牌可以定位。判定信心：${escapeHtml(match.confidence)}`;
      } else {
        panel.classList.add("warning");
        panel.innerHTML = "這兩個品牌不在同一段可判定走道，請改選其中一側。";
      }
      return;
    }
    const knownSide = right ? "right" : left ? "left" : null;
    const known = right || left;
    if (!knownSide) return;
    const options = compatibilityOptions(known, knownSide).slice(0, 10);
    panel.classList.remove("hidden");
    if (!options.length) {
      panel.classList.add("warning");
      panel.textContent = "目前找不到可搭配的對側品牌，請改用入口定位或較大型地標。";
      return;
    }
    const targetSide = knownSide === "right" ? "left" : "right";
    panel.innerHTML = `另一側請從相鄰品牌選擇：<div class="compatible-chips">${options.map((item) => `
      <button class="compatible-chip" type="button" data-compatible-label="${escapeHtml(item.label)}" data-compatible-side="${targetSide}">${escapeHtml(item.label)}</button>`).join("")}</div>`;
    panel.querySelectorAll("[data-compatible-label]").forEach((button) => {
      button.addEventListener("click", () => {
        sideInput(button.dataset.compatibleSide).value = button.dataset.compatibleLabel;
        renderCompatibility();
        closeSuggestions();
      });
    });
  }

  function closeSuggestions() {
    $$(".suggestions").forEach((panel) => panel.classList.remove("open"));
  }

  function attachBrandAutocomplete(side) {
    const input = sideInput(side);
    const panel = $(`#${side}Suggestions`);
    const otherSide = side === "right" ? "left" : "right";
    const render = (force = false) => {
      const other = resolveBrand(sideInput(otherSide).value);
      const allowed = other ? compatibilityOptions(other, otherSide).map((item) => item.label) : null;
      const matches = matchesFor(input.value, allowed);
      const caption = other
        ? `<div class="suggestion-caption">只顯示與${otherSide === "right" ? "右" : "左"}側「${escapeHtml(other)}」相鄰的品牌</div>`
        : "";
      panel.innerHTML = caption + matches.map((label) => `<button class="suggestion-item" type="button" role="option" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join("");
      panel.classList.toggle("open", matches.length > 0 && (force || document.activeElement === input));
      panel.querySelectorAll("[data-label]").forEach((button) => {
        button.addEventListener("click", () => {
          input.value = button.dataset.label;
          state.lastEditedSide = side;
          closeSuggestions();
          renderCompatibility();
          if (!resolveBrand(sideInput(otherSide).value)) {
            sideInput(otherSide).focus({ preventScroll: true });
          }
        });
      });
    };
    input.addEventListener("focus", () => { state.lastEditedSide = side; render(true); });
    input.addEventListener("input", () => { state.lastEditedSide = side; renderCompatibility(); render(true); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") panel.classList.remove("open");
    });
  }

  function getStartPosition() {
    if (state.positionMode === "entrance") {
      const key = $("#entranceSelect").value;
      const entrance = entrances[key];
      if (!entrance) return { error: "請先選擇你所在的入口。" };
      return {
        point: entrance.point,
        heading: entrance.heading,
        corridor: entrance.corridor,
        where: entrance.where,
        startBrands: [],
      };
    }
    const rawRight = $("#rightBrand").value.trim();
    const rawLeft = $("#leftBrand").value.trim();
    if (!rawRight || !rawLeft) return { error: "請把左手邊與右手邊的品牌都選好。" };
    const right = resolveBrand(rawRight);
    const left = resolveBrand(rawLeft);
    if (!right || !left) return { error: "有品牌名稱無法唯一辨識，請從輸入框的建議清單選擇。" };
    if (right === left) return { error: "左右兩側不能是同一個品牌。" };
    const match = locatePair(right, left);
    if (!match) return { error: "這兩個品牌不在同一段可判定走道，請改用相鄰品牌或入口定位。" };
    $("#rightBrand").value = right;
    $("#leftBrand").value = left;
    return {
      point: match.point,
      heading: match.heading,
      corridor: match.corridor,
      where: `「${left}」與「${right}」之間的${corridors[match.corridor].name}`,
      confidence: match.confidence,
      startBrands: [right, left],
    };
  }

  function renderError(message) {
    const result = $("#routeResult");
    result.classList.remove("hidden");
    result.innerHTML = `<div class="route-card error"><span class="route-label">需要補充資料</span><h2>還不能規劃路線</h2><p>${escapeHtml(message)}</p></div>`;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fitViewBox(route) {
    const points = [...route.path, route.boothPoint];
    let minX = Math.min(...points.map((point) => point[0]));
    let maxX = Math.max(...points.map((point) => point[0]));
    let minY = Math.min(...points.map((point) => point[1]));
    let maxY = Math.max(...points.map((point) => point[1]));
    let width = maxX - minX;
    let height = maxY - minY;
    const pad = Math.max(75, Math.min(155, Math.max(width, height) * 0.14));
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    width = maxX - minX; height = maxY - minY;
    if (width < 500) { const delta = (500 - width) / 2; minX -= delta; width = 500; }
    if (height < 550) { const delta = (550 - height) / 2; minY -= delta; height = 550; }
    minX = clamp(minX, 0, Math.max(0, MAP_W - width));
    minY = clamp(minY, 0, Math.max(0, MAP_H - height));
    return [minX, minY, Math.min(MAP_W, width), Math.min(MAP_H, height)];
  }

  function svgMarkup(route, id) {
    const pathPoints = [...route.path, route.boothPoint];
    const points = pathPoints.map((point) => point.map((value) => Math.round(value * 10) / 10).join(",")).join(" ");
    const view = fitViewBox(route);
    const [sx, sy] = route.start;
    const [dx, dy] = route.boothPoint;
    const arrowLength = 34;
    const ax = sx + Math.cos(route.heading) * arrowLength;
    const ay = sy + Math.sin(route.heading) * arrowLength;
    const destinationLabel = route.destination.name.length > 18 ? `${route.destination.name.slice(0, 17)}…` : route.destination.name;
    const destinationWidth = Math.min(230, Math.max(132, destinationLabel.length * 16));
    const destinationX = clamp(dx - destinationWidth / 2, 8, MAP_W - destinationWidth - 8);
    const destinationLabelY = dy < 95 ? dy + 58 : dy - 62;
    const startLabelX = clamp(sx + (sx > 1320 ? -130 : 18), 8, MAP_W - 118);
    const startLabelY = sy < 70 ? sy + 54 : sy - 20;
    return `<svg class="route-map" id="${id}" viewBox="${view.join(" ")}" data-route-view="${view.join(" ")}" xmlns="http://www.w3.org/2000/svg" aria-label="前往${escapeXml(route.destination.name)}的推薦路線圖">
      <defs>
        <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#5a120f" flood-opacity=".35"/></filter>
        <marker id="arrow-${id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e42d36"/></marker>
      </defs>
      <image href="${MAP_URL}" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none"/>
      <polyline class="route-underlay" points="${points}"/>
      <polyline class="route-line" points="${points}" style="filter:url(#shadow-${id})"/>
      <g aria-label="目前位置">
        <line x1="${sx}" y1="${sy}" x2="${ax}" y2="${ay}" stroke="#e42d36" stroke-width="6" stroke-linecap="round" marker-end="url(#arrow-${id})"/>
        <circle cx="${sx}" cy="${sy}" r="15" fill="#fff" stroke="#e42d36" stroke-width="5"/><circle cx="${sx}" cy="${sy}" r="6" fill="#e42d36"/>
        <rect x="${startLabelX}" y="${startLabelY - 23}" width="110" height="30" rx="10" fill="rgba(255,255,255,.97)" stroke="#e42d36" stroke-width="2"/>
        <text x="${startLabelX + 55}" y="${startLabelY - 3}" text-anchor="middle" font-size="15" font-weight="900" fill="#b51920">你在這裡</text>
      </g>
      <g aria-label="目的地">
        <path d="M${dx} ${dy - 27}c-13 0-23 10-23 22 0 17 23 38 23 38s23-21 23-38c0-12-10-22-23-22z" fill="#e42d36" stroke="#fff" stroke-width="4"/>
        <circle cx="${dx}" cy="${dy - 5}" r="7" fill="#fff"/>
        <rect x="${destinationX}" y="${destinationLabelY - 24}" width="${destinationWidth}" height="32" rx="10" fill="rgba(255,255,255,.98)" stroke="#e42d36" stroke-width="2"/>
        <text x="${destinationX + destinationWidth / 2}" y="${destinationLabelY - 3}" text-anchor="middle" font-size="14" font-weight="900" fill="#b51920">${escapeXml(destinationLabel)}</text>
      </g>
    </svg>`;
  }

  function setupPanZoom(svg) {
    if (!svg) return null;
    const routeView = svg.dataset.routeView.split(" ").map(Number);
    let view = [...routeView];
    let dragging = false;
    let startPoint = null;
    let startView = null;
    const apply = () => svg.setAttribute("viewBox", view.join(" "));
    const zoom = (factor) => {
      const [x, y, width, height] = view;
      const nextWidth = Math.max(220, Math.min(MAP_W, width * factor));
      const nextHeight = Math.max(240, Math.min(MAP_H, height * factor));
      const nextX = clamp(x + (width - nextWidth) / 2, 0, MAP_W - nextWidth);
      const nextY = clamp(y + (height - nextHeight) / 2, 0, MAP_H - nextHeight);
      view = [nextX, nextY, nextWidth, nextHeight];
      apply();
    };
    svg.addEventListener("pointerdown", (event) => {
      dragging = true;
      svg.classList.add("dragging");
      svg.setPointerCapture(event.pointerId);
      startPoint = [event.clientX, event.clientY];
      startView = [...view];
    });
    svg.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      const dx = (event.clientX - startPoint[0]) * (startView[2] / rect.width);
      const dy = (event.clientY - startPoint[1]) * (startView[3] / rect.height);
      view = [
        clamp(startView[0] - dx, 0, MAP_W - startView[2]),
        clamp(startView[1] - dy, 0, MAP_H - startView[3]),
        startView[2],
        startView[3],
      ];
      apply();
    });
    const stop = (event) => {
      dragging = false;
      svg.classList.remove("dragging");
      try { svg.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
    return {
      zoomIn: () => zoom(0.78),
      zoomOut: () => zoom(1.28),
      full: () => { view = [0, 0, MAP_W, MAP_H]; apply(); },
      route: () => { view = [...routeView]; apply(); },
    };
  }

  function bindMap(route) {
    const controls = setupPanZoom($("#routeSvg"));
    $$("[data-map-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mapAction;
        if (action === "zoom-in") controls.zoomIn();
        if (action === "zoom-out") controls.zoomOut();
        if (action === "full") {
          if (button.dataset.full === "1") {
            controls.route(); button.dataset.full = "0"; button.textContent = "全圖";
          } else {
            controls.full(); button.dataset.full = "1"; button.textContent = "路線";
          }
        }
        if (action === "open") openMapModal(route);
      });
    });
  }

  function openMapModal(route) {
    $("#modalTitle").textContent = route.title;
    $("#modalMap").innerHTML = svgMarkup(route, "modalRouteSvg");
    $("#mapModal").classList.add("open");
    setupPanZoom($("#modalRouteSvg"));
  }

  function closeMapModal() {
    $("#mapModal").classList.remove("open");
    $("#modalMap").innerHTML = "";
  }

  function renderRoute(route) {
    state.currentRoute = route;
    const confidence = route.confidence ? ` · 定位信心 ${route.confidence}` : "";
    const mapTarget = route.targetMapLabel !== route.destination.name ? `（地圖標示：${route.targetMapLabel}）` : "";
    const result = $("#routeResult");
    result.classList.remove("hidden");
    result.innerHTML = `<div class="route-card">
      <span class="route-label">目前位置：${escapeHtml(route.where)}${escapeHtml(confidence)}</span>
      <h2>${escapeHtml(route.title)}</h2>
      <p>${escapeHtml(route.orientation)}${escapeHtml(mapTarget)}</p>
      <ol class="route-steps">${route.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <div class="map-card">
        <div class="map-head">
          <strong>紅點：你的位置｜紅線：重新計算後的路線</strong>
          <div class="map-tools">
            <button class="map-tool" type="button" data-map-action="zoom-in" aria-label="放大地圖">＋</button>
            <button class="map-tool" type="button" data-map-action="zoom-out" aria-label="縮小地圖">−</button>
            <button class="map-tool" type="button" data-map-action="full">全圖</button>
            <button class="map-tool" type="button" data-map-action="open" aria-label="全螢幕地圖">⛶</button>
          </div>
        </div>
        <div class="map-viewport">${svgMarkup(route, "routeSvg")}</div>
        <div class="map-legend"><span><span class="legend-dot"></span>你在這裡</span><span><span class="legend-line"></span>推薦路線</span><span>📍 ${escapeHtml(route.destination.name)}</span></div>
      </div>
      <div class="route-note">路線依官方平面圖的主要走道計算。若現場有排隊護欄、臨時封路或工作人員引導，請以現場動線為準。</div>
    </div>`;
    bindMap(route);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitRoute(event) {
    event.preventDefault();
    if (!state.destination) {
      renderError("請先搜尋 IP 並選擇廠商，或直接選擇目的地。");
      return;
    }
    if (state.destination.locationStatus !== "mapped" || !state.destination.mapLabels.length) {
      renderError(`「${state.destination.name}」已收錄品牌／IP資料，但官方地圖上的確切攤位位置尚未確認，因此暫不產生可能誤導的路線。`);
      return;
    }
    const start = getStartPosition();
    if (start.error) {
      renderError(start.error);
      return;
    }
    const route = routeToDestination(start);
    if (!route) {
      renderError("目前位置與目的地之間沒有可用的走道連線，請改用較近的入口或主要走道品牌定位。");
      return;
    }
    renderRoute(route);
  }

  function renderCatalog() {
    const labels = [...new Set(brands.map((brand) => brand.label))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
    $("#brandCatalog").innerHTML = labels.map((label) => `<button class="catalog-chip" type="button" data-catalog-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join("");
    $$("[data-catalog-label]").forEach((button) => {
      button.addEventListener("click", () => {
        switchDestinationMode("direct");
        const destination = destinationByKey.get(`map:${button.dataset.catalogLabel}`);
        setDestination(destination);
        $("#destinationSearch").value = button.dataset.catalogLabel;
        renderDestinationResults();
        $("#destinationTitle").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initialize() {
    renderDataBadges();
    renderIpResults();
    renderDestinationResults();
    renderCatalog();

    const entranceSelect = $("#entranceSelect");
    for (const name of Object.keys(entrances)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      entranceSelect.appendChild(option);
    }

    $$('[data-destination-mode]').forEach((button) => button.addEventListener("click", () => switchDestinationMode(button.dataset.destinationMode)));
    $$('[data-position-mode]').forEach((button) => button.addEventListener("click", () => switchPositionMode(button.dataset.positionMode)));
    $("#ipSearch").addEventListener("input", renderIpResults);
    $("#destinationSearch").addEventListener("input", renderDestinationResults);
    $("#clearIpSearch").addEventListener("click", () => { $("#ipSearch").value = ""; renderIpResults(); $("#ipSearch").focus(); });
    $("#clearDestinationSearch").addEventListener("click", () => { $("#destinationSearch").value = ""; renderDestinationResults(); $("#destinationSearch").focus(); });
    $("#swapBrands").addEventListener("click", () => {
      const right = $("#rightBrand").value;
      $("#rightBrand").value = $("#leftBrand").value;
      $("#leftBrand").value = right;
      renderCompatibility();
    });
    attachBrandAutocomplete("left");
    attachBrandAutocomplete("right");
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".autocomplete-field")) closeSuggestions();
    });
    $("#navigationForm").addEventListener("submit", submitRoute);
    $("#closeMapModal").addEventListener("click", closeMapModal);
    $("#mapModal").addEventListener("click", (event) => { if (event.target === $("#mapModal")) closeMapModal(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("#mapModal").classList.contains("open")) closeMapModal(); });
  }

  initialize();

  window.__EXPO_NAV_TEST__ = {
    meta,
    brands,
    vendors,
    ipRecords,
    resolveBrand,
    locatePair,
    compatibilityOptions,
    shortestPath,
    setDestination,
    getState: () => ({ ...state }),
    planRouteForTest(destination, start) {
      state.destination = destination;
      return routeToDestination(start);
    },
  };
})();
