import json
def page(ar_title, ar_body, en_title, en_body, show_code=True, link=None, ar_link=None, en_link=None, ar_foot='', en_foot=''):
    code = '''<div style="margin:22px 0 6px;text-align:center"><div style="display:inline-block;background:#F1F3FF;border-radius:16px;padding:16px 26px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0A0A0B" dir="ltr">{{ .Token }}</div></div>''' if show_code else ''
    def btn(label):
        return f'''<p style="margin:18px 0 0;text-align:center"><a href="{link}" style="display:inline-block;background:#3355FF;color:#FFFFFF;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 26px;font-size:15px">{label}</a></p>''' if link else ''
    return f'''<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F5F7">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;color:#0A0A0B">
  <div style="text-align:center;font-size:26px;font-weight:800;color:#3355FF;letter-spacing:-0.5px;margin-bottom:16px">Adro</div>
  <div style="background:#FFFFFF;border-radius:24px;padding:26px 24px" dir="rtl" lang="ar">
    <h2 style="margin:0 0 8px;font-size:20px;text-align:right">{ar_title}</h2>
    <p style="margin:0;font-size:15px;line-height:1.8;color:#3F3F46;text-align:right">{ar_body}</p>
    {code}
    {btn(ar_link) if ar_link else ''}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#71717A;text-align:right">{ar_foot}</p>
  </div>
  <div style="background:#FFFFFF;border-radius:24px;padding:26px 24px;margin-top:12px" dir="ltr" lang="en">
    <h2 style="margin:0 0 8px;font-size:20px">{en_title}</h2>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#3F3F46">{en_body}</p>
    {code}
    {btn(en_link) if en_link else ''}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#71717A">{en_foot}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#A1A1AA;margin-top:18px">Adro · adroapp.com</p>
</div></body></html>'''

ign_ar='ما طلبت هذا؟ تجاهل الإيميل، وما بيتغير شي في حسابك.'
ign_en="Didn't ask for this? Ignore this email and nothing changes."
cfg = {
 'mailer_subjects_confirmation': 'رمز تأكيد Adro: {{ .Token }} · Your Adro code',
 'mailer_templates_confirmation_content': page('أكّد إيميلك','اكتب هذا الرمز في Adro عشان تكمّل تسجيلك. الرمز صالح لمدة ساعة.','Confirm your email','Enter this code in Adro to finish signing up. It works for 1 hour.', link='{{ .ConfirmationURL }}', ar_link='أو أكّد بالرابط', en_link='Or confirm with a link', ar_foot=ign_ar, en_foot=ign_en),
 'mailer_subjects_magic_link': 'رمز الدخول إلى Adro: {{ .Token }} · Your Adro sign-in code',
 'mailer_templates_magic_link_content': page('رمز الدخول','اكتب هذا الرمز في Adro عشان تدخل حسابك. الرمز صالح لمدة ساعة، ويُستخدم مرة وحدة.','Your sign-in code','Enter this code in Adro to sign in. It works for 1 hour, once.', link='{{ .ConfirmationURL }}', ar_link='أو ادخل بالرابط', en_link='Or sign in with a link', ar_foot=ign_ar, en_foot=ign_en),
 'mailer_subjects_recovery': 'رمز تغيير كلمة المرور: {{ .Token }} · Reset your Adro password',
 'mailer_templates_recovery_content': page('تغيير كلمة المرور','اكتب هذا الرمز في Adro، وبعدها تختار كلمة مرور جديدة. الرمز صالح لمدة ساعة.','Reset your password','Enter this code in Adro, then choose a new password. It works for 1 hour.', link='{{ .ConfirmationURL }}', ar_link='أو غيّرها بالرابط', en_link='Or reset with a link', ar_foot=ign_ar+' كلمة مرورك الحالية تظل زي ما هي.', en_foot=ign_en+' Your password stays the same.'),
 'mailer_subjects_email_change': 'أكّد إيميلك الجديد في Adro: {{ .Token }} · Confirm your new email',
 'mailer_templates_email_change_content': page('أكّد إيميلك الجديد','اكتب هذا الرمز في Adro عشان يصير <b dir="ltr">{{ .NewEmail }}</b> إيميل حسابك. الرمز صالح لمدة ساعة.','Confirm your new email','Enter this code in Adro to make <b>{{ .NewEmail }}</b> your account email. It works for 1 hour.', link='{{ .ConfirmationURL }}', ar_link='أو أكّد بالرابط', en_link='Or confirm with a link', ar_foot=ign_ar, en_foot=ign_en),
 'mailer_subjects_reauthentication': 'رمز التحقق في Adro: {{ .Token }} · Your Adro verification code',
 'mailer_templates_reauthentication_content': page('رمز التحقق','اكتب هذا الرمز في Adro عشان نتأكد إنه أنت.','Your verification code','Enter this code in Adro to confirm it’s you.', ar_foot=ign_ar, en_foot=ign_en),
}
json.dump(cfg, open('templates.json','w'), ensure_ascii=False)

print('ok')
