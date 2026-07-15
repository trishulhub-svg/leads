#!/usr/bin/env bash
# Assemble Trishulhub Leads product walkthrough with section titles + voiceover.
set -euo pipefail

FRAMES="/opt/cursor/artifacts/walkthrough-frames"
TITLES="/opt/cursor/artifacts/walkthrough-titles"
CLIPS="/opt/cursor/artifacts/walkthrough-clips"
AUDIO="/opt/cursor/artifacts/walkthrough-audio"
OUT="/opt/cursor/artifacts/trishulhub-leads-walkthrough.mp4"
LIST="/tmp/walkthrough-concat.txt"
VOICE_WAV="/tmp/walkthrough-voice.wav"
MIXED="/tmp/walkthrough-mixed.mp4"

rm -rf "$TITLES" "$CLIPS" "$AUDIO"
mkdir -p "$TITLES" "$CLIPS" "$AUDIO"

BG="0b1f2a"
ACCENT="0f766e"
FG="f8fafc"
MUTED="94a3b8"

make_title() {
  local file="$1" main="$2" sub="$3"
  ffmpeg -y -f lavfi -i "color=c=0x${BG}:s=1440x900:d=1" \
    -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='Trishulhub Leads':fontsize=28:fontcolor=0x${ACCENT}:x=(w-text_w)/2:y=280,\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${main}':fontsize=52:fontcolor=0x${FG}:x=(w-text_w)/2:y=360,\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${sub}':fontsize=24:fontcolor=0x${MUTED}:x=(w-text_w)/2:y=450" \
    -frames:v 1 "$file" </dev/null 2>/dev/null
}

make_title "$TITLES/00-intro.png" "How to use the product" "Login · Reset password · Brand · Templates · Leads · CRM"
make_title "$TITLES/t1-login.png" "1. Sign in" "Open your workspace with email and password"
make_title "$TITLES/t2-reset.png" "2. Reset password" "Use Forgot password if you need a reset link"
make_title "$TITLES/t3-brand.png" "3. Email brand setup" "Set brand name, sign-off, and accent color"
make_title "$TITLES/t4-templates.png" "4. Edit and preview templates" "Visual editor, HTML, and live preview"
make_title "$TITLES/t5-leads.png" "5. Import leads" "Smart importer maps columns and de-duplicates"
make_title "$TITLES/t6-crm.png" "6. Work replies in CRM" "Move deals across Contacted · Discussed · Done"
make_title "$TITLES/99-outro.png" "You're ready" "Import leads · Brand emails · Run outreach · Close in CRM"

# key|duration|spoken narration (empty = silence pad for that clip)
SPECS=(
  "00-intro|3.5|Welcome to Trishulhub Leads. This quick tour covers login, password reset, email brand setup, template editing, lead import, and CRM. SMTP is already configured, so we will skip that."
  "t1-login|2.4|Step one. Sign in to your workspace."
  "01-login-landing|3.0|Open the login page and enter your owner email and password."
  "02-login-filled|2.2|Fill the form, then click Sign In."
  "03-dashboard|2.8|You land on the dashboard, ready to work."
  "t2-reset|2.4|Step two. Reset your password if needed."
  "04-forgot-password|2.6|From login, open Forgot password."
  "05-forgot-password-filled|2.2|Enter the owner email address."
  "06-forgot-password-result|3.0|Submit to receive a secure reset link."
  "07-dashboard-after-login|2.2|Sign back in to continue."
  "t3-brand|2.4|Step three. Set up your email brand."
  "08-campaigns|2.4|Go to Campaigns."
  "09-templates|2.6|Open the Email templates tab."
  "10-brand-setup|3.6|Set brand name, sign-off name, and accent color. Optionally upload a logo."
  "11-brand-saved|2.6|Click Save brand. These settings apply across every template."
  "t4-templates|2.4|Step four. Edit and preview an email template."
  "12-template-selected|2.6|Choose a template from the list, like Cold Intro."
  "13-template-visual|3.4|In Visual mode, edit the headline, body, and call to action."
  "14-template-preview|4.0|Switch to Preview to see the branded email with sample lead data."
  "15-template-html|2.6|Use the HTML tab when you need raw markup control."
  "16-template-preview-final|3.2|Return to Preview and save your changes when ready."
  "t5-leads|2.4|Step five. Import leads into your database."
  "17-leads|2.6|Open Leads to use the smart importer."
  "18-leads-import-ready|2.4|Optionally set a default niche, then choose a CSV or Excel file."
  "19-leads-imported|4.0|The importer maps columns automatically, removes duplicates, and shows what was added."
  "20-leads-directory|3.0|Your cleaned leads appear in the directory, ready for campaigns."
  "t6-crm|2.4|Step six. Manage replies in CRM."
  "21-crm|3.2|The board shows Contacted, Discussed, and Done stages."
  "22-crm-drawer|4.0|Open a card to update notes, stage, priority, deal value, and follow-up date."
  "23-crm-final|2.8|Save changes and keep moving deals through the pipeline."
  "99-outro|3.6|That's the full flow. Sign in, brand your emails, import leads, and close conversations in CRM."
)

: > "$LIST"
i=0
VOICE_PARTS=()

for spec in "${SPECS[@]}"; do
  IFS='|' read -r key dur text <<<"$spec"
  i=$((i + 1))

  if [[ -f "$TITLES/${key}.png" ]]; then
    src="$TITLES/${key}.png"
  elif [[ -f "$FRAMES/${key}.png" ]]; then
    src="$FRAMES/${key}.png"
  else
    echo "Missing frame: $key" >&2
    exit 1
  fi

  clip=$(printf "%s/%03d-%s.mp4" "$CLIPS" "$i" "$key")
  ffmpeg -y -loop 1 -i "$src" -t "$dur" \
    -vf "scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" \
    -c:v libx264 -pix_fmt yuv420p -tune stillimage -crf 20 \
    "$clip" </dev/null 2>/dev/null
  echo "file '$clip'" >> "$LIST"

  # Voice clip padded/truncated to exact duration
  raw="$AUDIO/${i}-raw.wav"
  pad="$AUDIO/${i}-pad.wav"
  espeak-ng -v en-us+m3 -s 145 -w "$raw" "$text" 2>/dev/null
  ffmpeg -y -i "$raw" -af "apad=whole_dur=${dur},atrim=0:${dur}" -ar 44100 -ac 1 "$pad" </dev/null 2>/dev/null
  VOICE_PARTS+=("$pad")
done

# Concat video
ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libx264 -pix_fmt yuv420p "/tmp/walkthrough-silent.mp4" </dev/null 2>/dev/null

# Concat voice
VOICE_LIST="/tmp/voice-concat.txt"
: > "$VOICE_LIST"
for p in "${VOICE_PARTS[@]}"; do
  echo "file '$p'" >> "$VOICE_LIST"
done
ffmpeg -y -f concat -safe 0 -i "$VOICE_LIST" -c:a pcm_s16le "$VOICE_WAV" </dev/null 2>/dev/null

# Mux
ffmpeg -y -i "/tmp/walkthrough-silent.mp4" -i "$VOICE_WAV" \
  -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "$OUT" </dev/null 2>/dev/null

echo "VIDEO=$OUT"
ls -lh "$OUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT"
