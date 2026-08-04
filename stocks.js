const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el={
 wallet:$("#stocks-wallet"),invested:$("#stocks-invested"),wealth:$("#stocks-total-wealth"),
 index:$("#market-index-value"),indexChange:$("#market-index-change"),regime:$("#market-regime"),
 countdown:$("#market-countdown"),lastTick:$("#market-last-tick"),message:$("#stocks-message"),
 search:$("#stock-search"),sector:$("#sector-filter"),sort:$("#stock-sort"),grid:$("#company-grid"),
 marketView:$("#market-view"),portfolioView:$("#portfolio-view"),communityView:$("#community-view"),newsView:$("#news-view"),
 pValue:$("#portfolio-value"),pUnreal:$("#portfolio-unrealised"),pReal:$("#portfolio-realised"),pTotal:$("#portfolio-total"),
 pChart:$("#portfolio-chart"),pTip:$("#portfolio-tooltip"),holdings:$("#holdings-list"),trades:$("#trade-list"),news:$("#news-list"),
 dialog:$("#stock-dialog"),close:$("#dialog-close"),dSector:$("#detail-sector"),dName:$("#detail-name"),dTicker:$("#detail-ticker"),
 dDescription:$("#detail-description"),dPrice:$("#detail-price"),dOwned:$("#detail-owned"),dAverage:$("#detail-average"),
 dChart:$("#detail-chart"),dTip:$("#detail-tooltip"),shares:$("#trade-shares"),estimate:$("#trade-estimate"),fee:$("#fee-note"),
 submit:$("#trade-submit"),tradeMessage:$("#trade-message"),max:$("#trade-max"),companyNews:$("#company-news"),communityHoldings:$("#community-holdings")
};
const sectors={gaming:"Gaming and entertainment",technology:"Technology",industry:"Transport and industry",consumer:"Consumer businesses"};
let overview=null,selectedTicker=null,detailDuration="1h",tradeSide="buy",portfolioDuration=localStorage.getItem("stock-portfolio-duration")||"30d";
let detailChartType=localStorage.getItem("stock-detail-chart-type")==="candlestick"?"candlestick":"line";
let nextTick=0,busy=false,tradeBusy=false,detailData=null,portfolioData=null,communityData=null,communityBusy=false;

const number=(v,d=0)=>new Intl.NumberFormat("en-AU",{maximumFractionDigits:d}).format(Number(v??0));
const price=v=>new Intl.NumberFormat("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v??0));
const shares=v=>new Intl.NumberFormat("en-AU",{maximumFractionDigits:4}).format(Number(v??0));
const cls=v=>Number(v)>0?"positive":Number(v)<0?"negative":"neutral";
const signed=v=>Number(v)>0?`+${number(v)}`:Number(v)<0?`−${number(Math.abs(v))}`:"0";
const percent=v=>`${Number(v)>0?"+":""}${Number(v??0).toFixed(2)}%`;
const time=v=>new Intl.DateTimeFormat("en-AU",{hour:"2-digit",minute:"2-digit"}).format(new Date(v));
const dateTime=v=>new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
function ago(v){const m=Math.max(0,Math.floor((Date.now()-new Date(v))/60000));return m<1?"Just now":m<60?`${m}m ago`:m<1440?`${Math.floor(m/60)}h ago`:`${Math.floor(m/1440)}d ago`}
function message(text="",type=""){el.message.textContent=text;el.message.className=`form-message ${type}`.trim()}
function tradeMessage(text="",type=""){el.tradeMessage.textContent=text;el.tradeMessage.className=`form-message ${type}`.trim()}
function company(t){return overview?.companies?.find(c=>c.ticker===t)}
function svg(name,attrs={}){const n=document.createElementNS("http://www.w3.org/2000/svg",name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n}

function miniChart(node,points,negative){
 node.replaceChildren();const vals=(points||[]).map(p=>Number(p.price)).filter(Number.isFinite);if(vals.length<2)return;
 const w=300,h=72,p=3,min=Math.min(...vals),max=Math.max(...vals),span=Math.max(max-min,.0001);
 const xy=vals.map((v,i)=>({x:p+i/(vals.length-1)*(w-2*p),y:p+(1-(v-min)/span)*(h-2*p)}));
 const line=xy.map((q,i)=>`${i?"L":"M"} ${q.x} ${q.y}`).join(" ");
 node.setAttribute("viewBox",`0 0 ${w} ${h}`);node.classList.toggle("negative",negative);
 node.append(svg("path",{d:`${line} L ${xy.at(-1).x} ${h} L ${xy[0].x} ${h} Z`,class:"area"}),svg("path",{d:line,class:"line"}));
}
function createCompany(c){
 const card=document.createElement("article");card.className="company-card";card.dataset.sector=c.sector;card.tabIndex=0;
 const head=document.createElement("div");head.className="card-head";
 const copy=document.createElement("div");copy.innerHTML=`<span class="ticker">${c.ticker}</span><h2>${c.name}</h2>`;
 const watch=document.createElement("button");watch.className=`watch ${c.watchlisted?"active":""}`;watch.textContent=c.watchlisted?"★":"☆";watch.title=c.watchlisted?"Remove from watchlist":"Add to watchlist";
 watch.onclick=async e=>{e.stopPropagation();try{const {error}=await supabaseClient.rpc("toggle_stock_watchlist",{p_ticker:c.ticker});if(error)throw error;await loadOverview(true)}catch(err){message(err.message,"error")}};
 head.append(copy,watch);
 const pr=document.createElement("div");pr.className="card-price";
 pr.innerHTML=`<div class="price-block"><strong>${price(c.price)}</strong><span>chips per share</span></div><span class="change ${cls(c.change_24h)}">${percent(c.change_24h)}</span>`;
 const chart=svg("svg",{class:"spark","aria-hidden":"true"});miniChart(chart,c.sparkline,Number(c.change_24h)<0);
 const foot=document.createElement("div");foot.className="card-foot";foot.innerHTML=`<span>${sectors[c.sector]}</span><strong>${Number(c.owned_shares)>0?`${shares(c.owned_shares)} shares · ${number(c.position_value)} chips`:"No position"}</strong>`;
 card.append(head,pr,chart,foot);const open=()=>openDetail(c.ticker);card.onclick=open;card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}};
 return card
}
function filtered(){
 const q=el.search.value.trim().toLowerCase(),s=el.sector.value,a=[...(overview?.companies||[])].filter(c=>(!q||c.name.toLowerCase().includes(q)||c.ticker.toLowerCase().includes(q))&&(s==="all"||c.sector===s));
 const sort=el.sort.value;
 a.sort((x,y)=>sort==="gain"?y.change_24h-x.change_24h:sort==="loss"?x.change_24h-y.change_24h:sort==="high"?y.price-x.price:sort==="low"?x.price-y.price:sort==="name"?x.name.localeCompare(y.name):Number(y.watchlisted)-Number(x.watchlisted)||x.name.localeCompare(y.name));
 return a
}
function renderGrid(){el.grid.replaceChildren();const a=filtered();if(!a.length){el.grid.innerHTML='<p class="empty">No companies match those filters.</p>';return}a.forEach(c=>el.grid.append(createCompany(c)))}
function renderHeader(){
 const p=overview.portfolio,m=overview.market;el.wallet.textContent=number(p.wallet_chips);el.invested.textContent=number(p.holdings_value);el.wealth.textContent=number(p.total_wealth);
 el.index.textContent=price(m.index_value);el.indexChange.textContent=percent(m.change_24h);el.indexChange.className=cls(m.change_24h);
 el.regime.textContent=m.regime[0].toUpperCase()+m.regime.slice(1);el.regime.className=m.regime==="bullish"?"positive":m.regime==="bearish"?"negative":"neutral";
 el.lastTick.textContent=time(overview.last_tick_at);nextTick=new Date(overview.next_tick_at).getTime()
}
function renderMetrics(){const p=overview.portfolio;el.pValue.textContent=`${number(p.holdings_value)} chips`;el.pUnreal.textContent=`${signed(p.unrealised_profit)} chips`;el.pUnreal.className=cls(p.unrealised_profit);el.pReal.textContent=`${signed(p.realised_profit)} chips`;el.pReal.className=cls(p.realised_profit);el.pTotal.textContent=`${number(p.total_wealth)} chips`}
function renderHoldings(){
 el.holdings.replaceChildren();const a=overview.holdings||[];if(!a.length){el.holdings.innerHTML='<p class="empty">No shares owned yet.</p>';return}
 a.forEach(h=>{const r=document.createElement("article");r.className="holding-row";r.tabIndex=0;r.innerHTML=`<div><strong>${h.ticker} · ${h.name}</strong><span>${sectors[h.sector]}</span></div><div><span>Shares</span><strong>${shares(h.shares)}</strong></div><div><span>Value</span><strong>${number(h.position_value)} chips</strong></div><div><span>Average</span><strong>${price(h.average_cost)}</strong></div><div><span>Unrealised</span><strong class="${cls(h.unrealised_profit)}">${signed(h.unrealised_profit)} chips</strong></div>`;r.onclick=()=>openDetail(h.ticker);el.holdings.append(r)})
}
function renderTrades(){
 el.trades.replaceChildren();const a=overview.recent_trades||[];if(!a.length){el.trades.innerHTML='<p class="empty">No trades yet.</p>';return}
 a.forEach(t=>{const r=document.createElement("article");r.className="trade-row";r.innerHTML=`<div><strong>${t.ticker} · ${t.name}</strong><span class="${t.side==="buy"?"positive":"neutral"}">${t.side.toUpperCase()}</span></div><div><span>Shares</span><strong>${shares(t.shares)}</strong></div><div><span>Wallet change</span><strong class="${cls(t.wallet_change)}">${signed(t.wallet_change)}</strong></div><div><span>${ago(t.created_at)}</span><strong>${price(t.execution_price)} each</strong></div>`;el.trades.append(r)})
}
function renderNews(target,a){
 target.replaceChildren();if(!a?.length){target.innerHTML='<p class="empty">No market news has been generated yet.</p>';return}
 a.forEach(n=>{const r=document.createElement("article");r.className="news-card";r.innerHTML=`<span class="news-icon ${cls(n.impact)}">${Number(n.impact)>=0?"↗":"↘"}</span><div><strong>${n.ticker?`${n.ticker} · `:""}${n.headline}</strong><p>${n.summary}</p></div><span>${ago(n.published_at)}</span>`;target.append(r)})
}
function renderCommunity(){
 el.communityHoldings.replaceChildren();const players=communityData?.players||[];
 if(!players.length){el.communityHoldings.innerHTML='<p class="empty">Nobody owns stock yet.</p>';return}
 players.forEach(player=>{
  const card=document.createElement("article");card.className=`community-player ${player.is_you?"you":""}`.trim();
  const head=document.createElement("div");head.className="community-player-head";
  const nameWrap=document.createElement("div");nameWrap.className="community-player-name";
  const name=document.createElement("strong");name.textContent=player.username;name.dataset.profileUserId=player.user_id;name.dataset.profileUsername=player.username;
  nameWrap.append(name);if(player.is_you){const you=document.createElement("span");you.className="you-chip";you.textContent="YOU";nameWrap.append(you)}
  const total=document.createElement("div");total.className="community-total";total.innerHTML=`<span>${number(player.position_count)} position${Number(player.position_count)===1?"":"s"}</span><strong>${number(player.total_value)} chips</strong>`;
  head.append(nameWrap,total);
  const positions=document.createElement("div");positions.className="community-positions";
  (player.positions||[]).forEach(position=>{
   const row=document.createElement("article");row.className="community-position";row.tabIndex=0;
   row.innerHTML=`<div><strong>${position.ticker} · ${position.name}</strong><span>${shares(position.shares)} shares at ${price(position.average_cost)} avg.</span></div><strong>${number(position.position_value)} chips</strong><strong class="position-profit ${cls(position.unrealised_profit)}">${signed(position.unrealised_profit)}</strong>`;
   const open=()=>openDetail(position.ticker);row.onclick=open;row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}};positions.append(row)
  });
  card.append(head,positions);el.communityHoldings.append(card)
 })
}
async function loadCommunity(force=false){
 if(communityBusy||communityData&&!force)return;communityBusy=true;
 try{const {data,error}=await supabaseClient.rpc("get_public_stock_holdings");if(error)throw error;communityData=data;renderCommunity()}
 catch(e){console.error(e);const failure=document.createElement("p");failure.className="empty";failure.textContent=e.message||"Community holdings could not be loaded.";el.communityHoldings.replaceChildren(failure)}
 finally{communityBusy=false}
}
function renderAll(){renderHeader();renderGrid();renderMetrics();renderHoldings();renderTrades();renderNews(el.news,overview.news);setView(localStorage.getItem("stock-view")||"market");updateEstimate()}
async function loadOverview(silent=false){if(busy)return;busy=true;try{const {data,error}=await supabaseClient.rpc("get_stock_market_overview");if(error)throw error;overview=data;communityData=null;renderAll();if(selectedTicker&&el.dialog.open)updateDetail(company(selectedTicker))}catch(e){console.error(e);if(!silent)message(e.message||"The stock market could not be loaded.","error")}finally{busy=false}}

function setView(view){
 if(!["market","portfolio","community","news"].includes(view))view="market";localStorage.setItem("stock-view",view);
 $$(".view-tab").forEach(b=>{const a=b.dataset.view===view;b.classList.toggle("active",a);b.setAttribute("aria-pressed",a)});
 el.marketView.classList.toggle("hidden",view!=="market");el.portfolioView.classList.toggle("hidden",view!=="portfolio");el.communityView.classList.toggle("hidden",view!=="community");el.newsView.classList.toggle("hidden",view!=="news");
 if(view==="portfolio")loadPortfolio(portfolioDuration);if(view==="community")loadCommunity()
}
function axisDate(t,d){return new Intl.DateTimeFormat("en-AU",d==="1h"||d==="6h"||d==="24h"?{hour:"2-digit",minute:"2-digit"}:d==="7d"||d==="30d"||d==="90d"?{day:"numeric",month:"short"}:{month:"short",year:"2-digit"}).format(new Date(t))}
function lineChart(node,tip,points,key,duration,formatter,label){
 node.replaceChildren();tip.classList.add("hidden");const a=(points||[]).map(p=>({at:+new Date(p.at),v:+p[key]})).filter(p=>Number.isFinite(p.at)&&Number.isFinite(p.v)).sort((x,y)=>x.at-y.at);
 const shell=node.parentElement,w=Math.max(shell.clientWidth,320),h=w<560?270:320,p={t:18,r:16,b:42,l:w<560?58:72};node.setAttribute("viewBox",`0 0 ${w} ${h}`);
 if(!a.length){const t=svg("text",{x:w/2,y:h/2,"text-anchor":"middle",class:"axis-label"});t.textContent="No history recorded yet.";node.append(t);return}
 let minT=a[0].at,maxT=a.at(-1).at;if(maxT<=minT){minT-=60000;maxT+=60000}let min=Math.min(...a.map(x=>x.v)),max=Math.max(...a.map(x=>x.v)),span=max-min,pad=span?Math.max(span*.1,.01):Math.max(Math.abs(max)*.08,1);min=Math.max(0,min-pad);max+=pad;if(max<=min)max=min+1;
 const pw=w-p.l-p.r,ph=h-p.t-p.b,x=t=>p.l+(t-minT)/(maxT-minT)*pw,y=v=>p.t+(1-(v-min)/(max-min))*ph;
 for(let i=0;i<5;i++){const yy=p.t+i/4*ph;node.append(svg("line",{x1:p.l,y1:yy,x2:w-p.r,y2:yy,class:"grid-line"}));const tx=svg("text",{x:p.l-8,y:yy+4,"text-anchor":"end",class:"axis-label"});tx.textContent=formatter(max-i/4*(max-min));node.append(tx)}
 for(let i=0;i<(w<560?4:6);i++){const n=w<560?4:6,xx=p.l+i/(n-1)*pw,t=minT+i/(n-1)*(maxT-minT),tx=svg("text",{x:xx,y:h-14,"text-anchor":i===0?"start":i===n-1?"end":"middle",class:"axis-label"});tx.textContent=axisDate(t,duration);node.append(tx)}
 const pts=a.map((q,i)=>({...q,i,x:x(q.at),y:y(q.v)})),d=pts.map((q,i)=>`${i?"L":"M"} ${q.x} ${q.y}`).join(" "),area=`M ${pts[0].x} ${p.t+ph} ${d.replace(/^M/,"L")} L ${pts.at(-1).x} ${p.t+ph} Z`;
 node.append(svg("path",{d:area,class:"chart-area"}),svg("path",{d,class:`chart-line ${pts.at(-1).v<pts[0].v?"negative":""}`}));
 const hl=svg("line",{class:"hover-line hidden",y1:p.t,y2:p.t+ph}),hp=svg("circle",{class:"hover-point hidden",r:5}),rect=svg("rect",{class:"interaction",x:p.l,y:p.t,width:pw,height:ph});
 const hide=()=>{hl.classList.add("hidden");hp.classList.add("hidden");tip.classList.add("hidden")};
 const show=e=>{const b=node.getBoundingClientRect(),sx=(e.clientX-b.left)*w/b.width;let q=pts.reduce((best,c)=>Math.abs(c.x-sx)<Math.abs(best.x-sx)?c:best,pts[0]);hl.setAttribute("x1",q.x);hl.setAttribute("x2",q.x);hp.setAttribute("cx",q.x);hp.setAttribute("cy",q.y);hl.classList.remove("hidden");hp.classList.remove("hidden");tip.innerHTML=`<strong>${formatter(q.v)} ${label}</strong><span>${dateTime(q.at)}</span>`;tip.classList.remove("hidden");const sb=shell.getBoundingClientRect(),left=Math.min(Math.max(b.left+q.x*b.width/w-sb.left-tip.offsetWidth/2,8),sb.width-tip.offsetWidth-8),top=Math.max(b.top+q.y*b.height/h-sb.top-tip.offsetHeight-12,8);tip.style.left=`${left}px`;tip.style.top=`${top}px`};
 rect.onpointermove=show;rect.onpointerdown=show;rect.onpointerleave=hide;node.append(hl,hp,rect)
}
function candlestickChart(node,tip,points,duration){
 node.replaceChildren();tip.classList.add("hidden");
 const raw=(points||[]).map(point=>({at:+new Date(point.at),open:+(point.open??point.price),high:+(point.high??point.price),low:+(point.low??point.price),close:+(point.close??point.price),volume:+(point.volume??0)})).filter(point=>[point.at,point.open,point.high,point.low,point.close].every(Number.isFinite)).sort((x,y)=>x.at-y.at);
 const a=[];for(let i=0;i<raw.length;i+=3){const group=raw.slice(i,i+3);if(!group.length)continue;a.push({at:group[0].at,open:group[0].open,high:Math.max(...group.map(point=>point.high)),low:Math.min(...group.map(point=>point.low)),close:group.at(-1).close,volume:group.reduce((sum,point)=>sum+point.volume,0)})}
 const shell=node.parentElement,w=Math.max(shell.clientWidth,320),h=w<560?270:320,p={t:18,r:16,b:42,l:w<560?58:72};node.setAttribute("viewBox",`0 0 ${w} ${h}`);
 if(!a.length){const t=svg("text",{x:w/2,y:h/2,"text-anchor":"middle",class:"axis-label"});t.textContent="No candle history recorded yet.";node.append(t);return}
 let minT=a[0].at,maxT=a.at(-1).at;if(maxT<=minT){minT-=60000;maxT+=60000}
 let min=Math.min(...a.map(point=>point.low)),max=Math.max(...a.map(point=>point.high)),span=max-min,pad=span?Math.max(span*.1,.01):Math.max(Math.abs(max)*.08,1);min=Math.max(0,min-pad);max+=pad;if(max<=min)max=min+1;
 const pw=w-p.l-p.r,ph=h-p.t-p.b,x=(time,index)=>a.length===1?p.l+pw/2:p.l+index/(a.length-1)*pw,y=value=>p.t+(1-(value-min)/(max-min))*ph;
 for(let i=0;i<5;i++){const yy=p.t+i/4*ph;node.append(svg("line",{x1:p.l,y1:yy,x2:w-p.r,y2:yy,class:"grid-line"}));const tx=svg("text",{x:p.l-8,y:yy+4,"text-anchor":"end",class:"axis-label"});tx.textContent=price(max-i/4*(max-min));node.append(tx)}
 for(let i=0;i<(w<560?4:6);i++){const n=w<560?4:6,xx=p.l+i/(n-1)*pw,t=minT+i/(n-1)*(maxT-minT),tx=svg("text",{x:xx,y:h-14,"text-anchor":i===0?"start":i===n-1?"end":"middle",class:"axis-label"});tx.textContent=axisDate(t,duration);node.append(tx)}
 const candleWidth=Math.max(2,Math.min(14,pw/Math.max(a.length,1)*.62));
 const candles=a.map((point,index)=>({...point,x:x(point.at,index)}));
 candles.forEach(point=>{const direction=point.close>=point.open?"up":"down",openY=y(point.open),closeY=y(point.close),top=Math.min(openY,closeY),bodyHeight=Math.max(Math.abs(closeY-openY),1.5);node.append(svg("line",{x1:point.x,y1:y(point.high),x2:point.x,y2:y(point.low),class:`candle-wick ${direction}`}),svg("rect",{x:point.x-candleWidth/2,y:top,width:candleWidth,height:bodyHeight,rx:1,class:`candle-body ${direction}`}))});
 const hl=svg("line",{class:"hover-line hidden",y1:p.t,y2:p.t+ph}),rect=svg("rect",{class:"interaction",x:p.l,y:p.t,width:pw,height:ph});
 const hide=()=>{hl.classList.add("hidden");tip.classList.add("hidden")};
 const show=e=>{const b=node.getBoundingClientRect(),sx=(e.clientX-b.left)*w/b.width,q=candles.reduce((best,current)=>Math.abs(current.x-sx)<Math.abs(best.x-sx)?current:best,candles[0]);hl.setAttribute("x1",q.x);hl.setAttribute("x2",q.x);hl.classList.remove("hidden");tip.innerHTML=`<strong>${dateTime(q.at)}</strong><span>Open ${price(q.open)} · High ${price(q.high)}</span><span>Low ${price(q.low)} · Close ${price(q.close)}</span><small>Volume ${number(q.volume)} chips</small>`;tip.classList.remove("hidden");const sb=shell.getBoundingClientRect(),left=Math.min(Math.max(b.left+q.x*b.width/w-sb.left-tip.offsetWidth/2,8),sb.width-tip.offsetWidth-8),top=Math.max(b.top+y(q.high)*b.height/h-sb.top-tip.offsetHeight-12,8);tip.style.left=`${left}px`;tip.style.top=`${top}px`};
 rect.onpointermove=show;rect.onpointerdown=show;rect.onpointerleave=hide;node.append(hl,rect)
}
function drawDetailChart(){
 if(!detailData)return;
 if(detailChartType==="candlestick")candlestickChart(el.dChart,el.dTip,detailData.points,detailDuration);
 else lineChart(el.dChart,el.dTip,detailData.points,"price",detailDuration,v=>price(v),"chips")
}
async function loadPortfolio(d){
 portfolioDuration=d;localStorage.setItem("stock-portfolio-duration",d);$$("#portfolio-ranges button").forEach(b=>b.classList.toggle("active",b.dataset.duration===d));
 try{const {data,error}=await supabaseClient.rpc("get_my_stock_portfolio_history",{p_duration:d});if(error)throw error;portfolioData=data;lineChart(el.pChart,el.pTip,data.points,"total",d,v=>number(v),"chips")}catch(e){console.warn(e)}
}
function updateDetail(c){if(!c)return;el.dSector.textContent=sectors[c.sector].toUpperCase();el.dName.textContent=c.name;el.dTicker.textContent=c.ticker;el.dDescription.textContent=c.description;el.dPrice.textContent=`${price(c.price)} chips`;el.dOwned.textContent=`${shares(c.owned_shares)} shares`;el.dAverage.textContent=`${price(c.average_cost)} chips`;updateEstimate()}
async function loadDetail(){const {data,error}=await supabaseClient.rpc("get_stock_company_history",{p_ticker:selectedTicker,p_duration:detailDuration});if(error)throw error;detailData=data;drawDetailChart();renderNews(el.companyNews,data.news)}
async function openDetail(t){selectedTicker=t;updateDetail(company(t));tradeMessage();if(!el.dialog.open)el.dialog.showModal();try{await loadDetail()}catch(e){tradeMessage(e.message,"error")}}
function closeDetail(){selectedTicker=null;detailData=null;el.dialog.close()}
function updateSide(){ $$("#side-buttons button").forEach(b=>b.classList.toggle("active",b.dataset.side===tradeSide));el.submit.textContent=tradeSide==="buy"?"Buy shares":"Sell shares";el.submit.classList.toggle("sell",tradeSide==="sell");updateEstimate()}
function shareValue(){const v=Number(el.shares.value);return Number.isFinite(v)?Math.max(v,0):0}
function updateEstimate(){const c=company(selectedTicker);if(!c){el.estimate.textContent="0 chips";return}const sh=shareValue(),ep=Number(c.price)*(tradeSide==="buy"?1.0025:.9975),gross=tradeSide==="buy"?Math.ceil(ep*sh):Math.floor(ep*sh),feeRate=tradeSide==="buy"?.005:.0025,fee=gross?Math.max(1,Math.ceil(gross*feeRate)):0,total=tradeSide==="buy"?gross+fee:Math.max(gross-fee,0);el.estimate.textContent=tradeSide==="buy"?`${number(total)} chips spent`:`${number(total)} chips received`;el.fee.textContent=`Estimated at ${price(ep)} per share · ${number(fee)} fee (${(feeRate*100).toFixed(2)}%)`}
function maxShares(){const c=company(selectedTicker);if(!c)return;if(tradeSide==="sell")el.shares.value=Number(c.owned_shares).toFixed(4);else{const wallet=Number(overview.portfolio.wallet_chips),v=Math.floor(wallet/(Number(c.price)*1.0025*1.005)*100)/100;el.shares.value=Math.max(v,0).toFixed(2)}updateEstimate()}
async function submitTrade(){if(tradeBusy||!selectedTicker)return;const sh=shareValue();if(sh<.01){tradeMessage("Enter at least 0.01 shares.","error");return}tradeBusy=true;el.submit.disabled=true;try{const {data,error}=await supabaseClient.rpc("execute_stock_trade",{p_ticker:selectedTicker,p_side:tradeSide,p_shares:sh});if(error)throw error;tradeMessage(`${tradeSide==="buy"?"Bought":"Sold"} ${shares(data.shares)} ${data.ticker} shares.`,"success");communityData=null;await loadOverview(true);await loadDetail();updateDetail(company(selectedTicker))}catch(e){tradeMessage(e.message||"The trade could not be completed.","error")}finally{tradeBusy=false;el.submit.disabled=false}}
function countdown(){if(!nextTick){el.countdown.textContent="--:--";return}const s=Math.max(0,Math.ceil((nextTick-Date.now())/1000));el.countdown.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;if(s===0)loadOverview(true)}

$$(".view-tab").forEach(b=>b.onclick=()=>setView(b.dataset.view));
[el.search,el.sector,el.sort].forEach(n=>n.addEventListener(n===el.search?"input":"change",renderGrid));
$$("#portfolio-ranges button").forEach(b=>b.onclick=()=>loadPortfolio(b.dataset.duration));
$$("#detail-ranges button").forEach(b=>b.onclick=async()=>{detailDuration=b.dataset.duration;$$("#detail-ranges button").forEach(x=>x.classList.toggle("active",x===b));if(selectedTicker)try{await loadDetail()}catch(e){tradeMessage(e.message,"error")}});
$$("#detail-chart-types button").forEach(b=>{b.classList.toggle("active",b.dataset.chartType===detailChartType);b.onclick=()=>{detailChartType=b.dataset.chartType;localStorage.setItem("stock-detail-chart-type",detailChartType);$$("#detail-chart-types button").forEach(x=>x.classList.toggle("active",x===b));drawDetailChart()}});
$$("#side-buttons button").forEach(b=>b.onclick=()=>{tradeSide=b.dataset.side;updateSide()});
$$(".quick-shares button[data-shares]").forEach(b=>b.onclick=()=>{el.shares.value=b.dataset.shares;updateEstimate()});
el.shares.oninput=updateEstimate;el.max.onclick=maxShares;el.submit.onclick=submitTrade;el.close.onclick=closeDetail;el.dialog.onclick=e=>{if(e.target===el.dialog)closeDetail()};
window.onresize=()=>{if(el.dialog.open&&detailData)drawDetailChart();if(portfolioData&&!el.portfolioView.classList.contains("hidden"))lineChart(el.pChart,el.pTip,portfolioData.points,"total",portfolioDuration,v=>number(v),"chips")};

(async function init(){
 const {data:{user},error}=await supabaseClient.auth.getUser();if(error||!user){location.href="login.html";return}
 await loadOverview();updateSide();countdown();setInterval(countdown,1000);setInterval(()=>loadOverview(true),30000)
})().catch(e=>{console.error(e);message(e.message||"The stock market could not be loaded.","error")});
