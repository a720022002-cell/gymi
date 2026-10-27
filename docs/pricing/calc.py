import json
R=3.75
# real average cost per request (USD), from ai_calls, 11-27 Oct 2026
C={'meal_photo_haiku':0.00089,'meal_photo_gemini':0.00171,'label_photo':0.00089,'chat':0.00084,'food_text':0.00034,'machine':0.00134,
   'cardio_tip':0.00031,'recap':0.00161,'plan':0.00253,'plan_review':0.00097,'recipes':0.00322,'recipe':0.00171,'reading':0.00057}
def month(photo_model, k):
    use={'meal_photo':90*k,'label_photo':6*k,'chat':60*k,'food_text':30*k,'machine':4*k,'cardio_tip':12*k,'recap':4,'plan':1,'plan_review':4,'recipes':2*k,'recipe':2*k,'reading':10*k}
    t=0
    for x,n in use.items():
        c=C[x+'_'+photo_model] if x=='meal_photo' else C[x]
        if x=='label_photo' and photo_model=='gemini': c=C['meal_photo_gemini']
        t+=n*c
    return t
out={}
for m in ['haiku','gemini']:
    out[m]={lvl:round(month(m,k),3) for lvl,k in [('light',0.4),('normal',1),('heavy',2.5)]}
# worst case: the daily cap of 80 requests every day at the dearest common request (machine)
out['cap']=round(80*30*0.00134,2)
# trial: 7 days, 3 photos, 4 messages, plus what runs by itself (first plan, 1 recap, 4 cardio tips)
for m in ['haiku','gemini']:
    p=C['meal_photo_'+m]
    out['trial_'+m]=round(3*p+4*C['chat']+C['plan']+C['recap']+4*C['cardio_tip'],4)
print(json.dumps(out,indent=1))
# store money per subscriber (SAR), VAT inside the price, Apple 15%
for price in [29,39,49]:
    net=price/1.15*0.85
    print(price,'net',round(net,2))
print('year 299 per month net', round(299/1.15*0.85/12,2))
