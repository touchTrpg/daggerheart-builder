import json, re, sys, copy
from bs4 import BeautifulSoup
src=sys.argv[1]; out=sys.argv[2]
s=BeautifulSoup(open(src,encoding='utf-8').read(),'lxml')

def clean(el):
    el=copy.copy(el)
    for x in el.select('.og-h-anchor,.og-ref'): x.decompose()
    for a in el.find_all('a'): a.unwrap()
    for sp in el.find_all('span'):
        sp.attrs={k:v for k,v in sp.attrs.items() if k=='class' and 'og-recall' in v}
        if not sp.attrs: sp.unwrap()
    for t in el.find_all(True):
        t.attrs={k:v for k,v in t.attrs.items() if k in ('class',)} if t.name=='span' else {}
    return el
def inner(el): return ''.join(str(c) for c in clean(el).contents).strip()
def txt(el): return clean(el).get_text(' ',strip=True)
def short(p):
    p=copy.copy(p)
    for o in p.select('.og-omit'): o.decompose()
    return txt(p)
def full(p): return txt(p)

def table(caption):
    for t in s.find_all('table'):
        c=t.find('caption')
        if c and caption in c.get_text(): return t
    raise Exception(caption)
def rows(t):
    return [[td.get_text(' ',strip=True) for td in tr.find_all(['td','th'])] for tr in t.find_all('tr')]

CLASSES=['bard','druid','guardian','ranger','rogue','seraph','sorcerer','warrior','wizard']
DOM={'arcana':'奧術','blade':'利刃','bone':'骸骨','codex':'典籍','grace':'優雅','midnight':'午夜','sage':'賢者','splendor':'輝耀','valor':'勇氣'}
DOMZ={v:k for k,v in DOM.items()}
classes=[]
for cid in CLASSES:
    d=s.find(id='define-'+cid)
    h=d.find(id=cid)
    ps=d.find_all('p',recursive=False)
    top=d.find(class_='og-topbar')
    info={}
    for li in top.find_all('li'):
        k=li.find('strong').get_text().strip('：: ').replace('初始','')
        li2=copy.copy(li); li2.find('strong').decompose()
        info[k]=li2.get_text('',strip=True)
    doms=[a['href'][8:] for a in top.find_all('li')[0].find_all('a')]
    hope=[];feats=[]
    cur=None
    for el in d.children:
        if getattr(el,'name',None)=='h4':
            t=el.get_text(); cur = hope if '希望' in t else feats if '職業特性' in t else None
        elif getattr(el,'name',None)=='ul' and cur is not None:
            for li in el.find_all('li',recursive=False): cur.append(inner(li))
    subs=[]
    for sd in s.find_all('div',id=re.compile('^define-'+cid+'-')):
        h5=sd.find('h5',id=sd['id'][7:])
        if not h5 or 'beastform' in sd['id'] or 'companion' in sd['id']: continue
        sp=sd.find('p',recursive=False)
        trait=None; found=[]; cur=None
        for el in sd.children:
            n=getattr(el,'name',None)
            if n=='h6':
                t=el.get_text(); cur='trait' if '施法' in t else 'found' if '基礎' in t else None
            elif n=='ul' and cur=='trait': trait=el.get_text(strip=True)
            elif n=='ul' and cur=='found':
                for li in el.find_all('li',recursive=False): found.append(inner(li))
        subs.append(dict(id=h5['id'],name=txt(h5),desc=full(sp) if sp else '',spellTrait=trait,features=found))
    classes.append(dict(id=cid,name=txt(h),short=short(ps[0]),desc=full(ps[0]),domains=doms,
        evasion=int(info['閃避值']),hp=int(info['生命點']),classItem=info.get('職業物品',''),hope=hope,features=feats,subclasses=subs))
names={c['name']:c['id'] for c in classes}
def bycls(cap):
    r={};last=None
    for row in rows(table(cap))[1:]:
        if row[0] in names: last=names[row[0]]; row=row[1:]
        r.setdefault(last,[]).append(row)
    return r
traits=bycls('建議屬性分配'); equip={}
for tr in table('建議武器與護甲').find('tbody').find_all('tr'):
    cid=names[tr.find('th').get_text(strip=True)]; items=[]
    for li in tr.find_all('li'):
        st=li.find('strong'); label=st.get_text(strip=True)
        li2=copy.copy(li); spans=[sp.get_text('',strip=True) for sp in li2.find_all('span',class_='og-divider')]
        for sp in li2.find_all('span'): sp.decompose()
        nm=li2.get_text('',strip=True).replace(label,'').strip()
        if '主武器' in label: kind='primary'
        elif '副武器' in label: kind='secondary'
        else: kind='armor'; nm=label
        items.append(dict(kind=kind,name=nm,stats=spans))
    equip[cid]=items
def qtable(cap):
    r={}
    for tr in table(cap).find('tbody').find_all('tr'):
        r[names[tr.find('th').get_text(strip=True)]]=[li.get_text(strip=True) for li in tr.find_all('li')]
    return r
bgq=qtable('背景問題'); conq=qtable('隊伍連結')
for c in classes:
    c['suggestedTraits']=traits.get(c['id'])[0]
    c['suggestedEquip']=equip.get(c['id'])
    c['backgroundQ']=bgq.get(c['id'],[])
    c['connectionQ']=conq.get(c['id'],[])

def heritage(listid, sec):
    res=[]
    d=s.find(id=listid)
    ids=[a['href'][8:] for a in d.select('.og-qr-compact a')]
    for i in ids:
        e=s.find(id='define-'+i)
        if not e: continue
        h=e.find(['h3','h4'])
        ps=[p for p in e.find_all('p',recursive=False)]
        q=e.find('p',class_='og-questions')
        feats=[]
        for ul in e.find_all('ul',class_='list-unstyled',recursive=False):
            for li in ul.find_all('li',recursive=False): feats.append(inner(li))
        res.append(dict(id=i,name=txt(h),short=short(ps[0]) if ps else '',desc=full(ps[0]) if ps else '',
            traits=full(q) if q else '',features=feats))
    return res
ancestries=heritage('define-ancestry','')
communities=heritage('define-community','')

cards=[]
for d in s.find_all('div',class_='og-domain'):
    h=d.find('h6');
    lis=d.find('ul',class_='list-unstyled').find_all('li',recursive=False)
    head=lis[0].get_text(strip=True)
    m=re.match(r'(\d+)\s*級\s*(\S+?)(法術|技能|咒語|典籍|能力|魔典)?$',head)
    lvl=int(re.search(r'\d+',head).group())
    dom=next(k for k in DOM if 'og-domain-'+k in d['class'])
    typ=re.sub(r'等級|級|\d+|\s','',head).replace(DOM[dom],'').strip()
    recall=re.search(r'\d+',lis[1].get_text()).group()
    cards.append(dict(id=h['id'],name=txt(h),domain=dom,level=lvl,type=typ,recall=int(recall),text=inner(lis[2])))

def wtable(id_):
    h=s.find(id=id_); t=h.find_next('table')
    rs=rows(t); hd=rs[0]
    return [dict(zip(hd,r)) for r in rs[1:] if len(r)==len(hd)]
equipment=dict(primaryPhysical=wtable('weapons-primary-tier-1-physical'),primaryMagic=wtable('weapons-primary-tier-1-magic'),
    secondary=wtable('weapons-secondary-tier-1'),armor=wtable('armor-tier-1'))
json.dump(dict(classes=classes,ancestries=ancestries,communities=communities,cards=cards,equipment=equipment,
   domainNames=DOM),open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(classes),len(ancestries),len(communities),len(cards),{k:len(v) for k,v in equipment.items()})

# example experiences
ex=s.find(id='example-experiences').find_parent('div')
cats={}; cur=None
for el in ex.find_all(['h4','h5','h6','dt','strong','li','th','td']):
    pass
txts=ex.get_text('|',strip=True).split('|')
CATS=['背景','特性','專長','技能','片語']
for w in txts:
    if w in CATS: cur=w; cats[cur]=[]
    elif cur and not w.startswith('第') and w!='經歷範例': cats[cur].append(w)
D=json.load(open(out,encoding='utf-8')); D['experienceExamples']=cats
json.dump(D,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print({k:len(v) for k,v in cats.items()})
