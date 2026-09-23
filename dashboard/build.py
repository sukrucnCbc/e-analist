import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
P = lambda f: os.path.join(SRC, f)
js1=open(P('tpl_js1.js')).read()
js1=js1.replace("  upt: ['UPT dağılımı'","  uptd: ['UPT dağılımı'").replace("  oos: ['Stoksuz barkodlar'","  oosl: ['Stoksuz barkodlar'")
js7=open(P('tpl_js7.js')).read()
js7=js7.replace("dCm += k * (-Dv * (1 - S.c * 0) / (1 + S.k) + COMM_R","dCm += k * (-Dv / (1 + S.k) + COMM_R")
js7=js7.replace("extraCm = cmOrder(extraF) - S.c * Dv / (1 + S.k) * 0","extraCm = cmOrder(extraF) - S.c * Dv / (1 + S.k)")
body=open(P('tpl_body.html')).read()
body=body.replace('<h3>Paket başına ürün adedi <button class="i" data-tip="upt">','<h3>Paket başına ürün adedi <button class="i" data-tip="uptd">')
body=body.replace('<h3>Stoksuz kalan barkodlar (22 Eylül) <button class="i" data-tip="oos">','<h3>Stoksuz kalan barkodlar (22 Eylül) <button class="i" data-tip="oosl">')
js=js1+''.join(open(P(f)).read() for f in ['tpl_js2.js','tpl_js3.js','tpl_js4.js','tpl_js5.js','tpl_js6.js'])+js7
js=js.replace("Ağustos\\'tan beri listede yok","Eylül raporunda listede yok")
js=js.replace("139 ₺\\'de, %40 maliyette neredeyse sıfır katkı bırakıyor","139 ₺\\'de, %40 maliyette tek ürünlük sipariş eksi katkı bırakıyor")
D=json.load(open(os.path.join(HERE, 'data.json')))
data=json.dumps(D,ensure_ascii=False,separators=(',',':'))
out=open(P('tpl_head.html')).read()+body+'<script>window.__DATA__='+data+';</script>\n<script>\n'+js+'\n</script>\n'
open(os.path.join(HERE, 'dist', 'ak-tuhafiye-buyume-paneli.html'), 'w').write(out); print(len(out))
