# 公開（ホスティング）の手順

GitHub にコードを置き、Cloudflare Pages がそれを自動で公開する形にする。
一度つなげば、あとは `git push` するたびに数十秒でサイトが更新される。

```
このMac ──git push──▶ GitHub（公開リポジトリ） ──自動──▶ Cloudflare Pages ──▶ https://○○.pages.dev
```

## なぜこの組み合わせか
- **ランキングも同じ場所で**：後で入れるランキングは、Cloudflare の Workers（サーバー処理）と D1（データベース）で作る。ホスティングと同じアカウントで完結する（Supabase などは使わない）。
- **プレビュー URL**：ブランチごとに確認用の URL が自動で作られる。
- **費用**：今の規模なら無料の範囲で収まる。

## 0. 先に決めておくこと
| 項目 | おすすめ | メモ |
|---|---|---|
| リポジトリ名 | `xyz-training` | 英数字とハイフンだけ |
| 公開/非公開 | 公開（Public） | JS はブラウザに配られるので、隠す意味はあまりない。パスワードや秘密のキーは絶対にコミットしない（後で使うキーは Cloudflare の設定画面に入れる） |
| サイトのアドレス | `xyz-training.pages.dev` | Cloudflare の「プロジェクト名」がそのままアドレスになる。取られていたら別名に |

## 1. GitHub に空のリポジトリを作る（ブラウザ）
1. https://github.com/new を開く（GitHub にログインした状態で）
2. 次のように入力する
   - **Repository name**：`xyz-training`
   - **Public** を選ぶ
   - 「Add a README」「.gitignore」「license」は**どれも付けない**（こちらで用意済み。付けると最初の push でぶつかる）
3. **Create repository** を押す
4. 次の画面に出る `https://github.com/<あなたのユーザー名>/xyz-training.git` をメモしておく

## 2. このフォルダを GitHub に送る（ターミナル）
フォルダの準備（`git init`、`.gitignore`、公開用ファイルをまとめるスクリプト）は済ませてある。

### 2-1. 名前とメールの設定（このMacで初めて git を使う場合だけ）
```bash
git config --global user.name "表示したい名前"
```
```bash
git config --global user.email "あなたのGitHubのnoreplyアドレス"
```
- noreply アドレスは GitHub の **Settings → Emails** に `12345678+name@users.noreply.github.com` の形で出ている。
- これを使うと、本当のメールアドレスがコミット履歴に残らない。

### 2-2. 最初のコミットと push
```bash
cd ~/Desktop/XYZトレーニング
```
```bash
git add -A
```
```bash
git commit -m "XYZトレーニング 初版"
```
```bash
git remote add origin https://github.com/<あなたのユーザー名>/xyz-training.git
```
```bash
git push -u origin main
```

**push のときにログインを求められたら**
- 以前このMacから GitHub Pages に push したことがあれば、たぶんそのまま通る。
- 通らない場合は、**GitHub Desktop**（https://desktop.github.com ）を使うのが一番かんたん。ブラウザでログインするだけで済む。
  1. GitHub Desktop を入れて起動し、GitHub アカウントでサインインする
  2. **File → Add Local Repository** で `デスクトップ/XYZトレーニング` を選ぶ
  3. 右上の **Push origin**（まだ remote がなければ **Publish repository**。このとき **Keep this code private** のチェックは外す）を押す
- これ以降の push も GitHub Desktop のボタンで行える。そのときは 6. のコマンドの代わりに、左下にメモを書いて **Commit to main** → **Push origin** を押す。

push できたら、GitHub のリポジトリのページを再読み込みして、ファイルが並んでいれば成功。

## 3. Cloudflare のアカウントを作る（ブラウザ）
1. https://dash.cloudflare.com/sign-up を開く
2. メールアドレスとパスワードで登録する。届いた確認メールのリンクを押す。
3. ログイン後に「ドメインを追加しますか」「プランを選びますか」などと聞かれても、今は不要。スキップするか、左のメニューへ進む。

## 4. Cloudflare Pages と GitHub をつなぐ
1. 左のメニューから **Workers & Pages**（「コンピューティング」の中にある場合も）→ **作成（Create）** を押す
2. **Pages** タブを選び、**既存の Git リポジトリをインポート（Import an existing Git repository / Connect to Git）** を押す
   - 画面が Workers の作成ばかりで Pages が見つからないときは、ページ下のほうの「Pages をお探しですか？」のようなリンクから入れる。
3. **GitHub** を選ぶと、GitHub 側に「Cloudflare Workers and Pages」アプリのインストール画面が出る
   - **Only select repositories** を選び、`xyz-training` だけにチェックを入れる。全部のリポジトリを渡す必要はない。
   - **Install & Authorize** を押す
4. Cloudflare に戻り、`xyz-training` を選んで **セットアップを開始（Begin setup）** を押す
5. ビルドの設定を次のように入力する

| 項目 | 入力する値 |
|---|---|
| プロジェクト名 | `xyz-training`（これがアドレスになる） |
| 本番ブランチ | `main` |
| フレームワーク プリセット | `None`（なし） |
| ビルドコマンド | `node scripts/build-site.js` |
| ビルド出力ディレクトリ | `site` |

6. **保存してデプロイ（Save and Deploy）** を押す。1分ほどでビルドが終わり、`https://xyz-training.pages.dev` が表示される。

> ビルドコマンドは、遊ぶのに必要なファイル（`index.html`・`style.css`・`js/`・`tiles/`）だけを `site/` に集めるもの。テストや動画のファイルは公開されない。

## 5. 公開できたかの確認
- [ ] スマホで `https://xyz-training.pages.dev` を開ける
- [ ] トップの手牌の画像が出ている
- [ ] 「今日の10問」を最後まで遊べる
- [ ] 下に KanjiVG のクレジットが出ている（牌画像のライセンス CC BY-SA の表示義務）

## 6. これからの更新のしかた
ファイルを直したら、次の3つを実行する。push すると自動でビルドされ、1分ほどで反映される。
```bash
git add -A
```
```bash
git commit -m "変更内容のメモ"
```
```bash
git push
```
- `main` 以外のブランチに push すると、本番とは別の確認用 URL ができる。本番に出す前に試したいときに使える。
- うまくいかなかった版は、Cloudflare の **Deployments（デプロイ）** 画面から、前の版に戻す（Rollback）ことができる。

## 7. ランキングを動かす設定（ランクチャレンジ）
ランキングの記録は Cloudflare の **D1**（データベース）に保存する。
表はアプリが最初のアクセスで自動で作るので、SQL を書く必要はない。
**この設定を済ませてから push する**（先に push しても、ランクチャレンジ以外は普通に動く）。

### 7-1. データベースを作る
1. 左のメニューの **Storage & databases → D1 SQL database** を開く
2. **Create**（作成）を押し、名前を `xyz-training` にして作成する（場所は自動のままでいい）

### 7-2. サイトとデータベースをつなぐ
1. **Workers & Pages** → `xyz-training`（Pages のプロジェクト）→ **Settings**（設定）→ **Bindings**（バインディング）
2. **Add** → **D1 database** を選ぶ
3. **Variable name** を `DB`（大文字）、**D1 database** を `xyz-training` にして保存する

### 7-3. 管理用の合言葉を入れる
不適切な名前を隠したり、記録を消したりするときに使う。
1. ターミナルで、合言葉にするランダムな文字列を作る（この文字列をパスワード管理アプリなどに保存しておく）
```bash
openssl rand -hex 24
```
2. 同じプロジェクトの **Settings → Variables and Secrets** → **Add**
3. **Type** を **Secret**、**Variable name** を `ADMIN_KEY`、**Value** に 1. の文字列を入れて保存する

### 7-4. 反映して確認
1. GitHub Desktop で **Push origin**（設定を変えた後のデプロイから反映される。すでに push 済みなら、Cloudflare の **Deployments** で最新のものを **Retry deployment**）
2. サイトで **ランクチャレンジ** を最後までやり、名前を登録して成績証明書が出れば完成

ビルドに1分ほどかかるようになる（ランクチャレンジの問題パック 2000個を作るため）。

### 管理のしかた
ターミナルから、合言葉付きで送る（`<合言葉>` を 7-3 の文字列に置き換える）。
```bash
curl -s -X POST https://xyz-training.pages.dev/api/admin -H 'x-admin-key: <合言葉>' -H 'content-type: application/json' -d '{"action":"list"}'
```
| やりたいこと | `-d` に入れる内容 |
|---|---|
| 最近登録された名前を見る | `{"action":"list"}` |
| 名前を隠す（ほかの人には名無しさん） | `{"action":"hide","name":"その名前"}` |
| 隠した名前を戻す | `{"action":"unhide","name":"その名前"}` |
| その人をランキングから締め出す | `{"action":"ban","name":"その名前"}` |
| 締め出しを解く | `{"action":"unban","name":"その名前"}` |
| 記録を1件消す（証明書の No.） | `{"action":"deleteRun","runId":"rtvm37e6ue"}` |
| 未対応のバグ報告を見る（新しい順） | `{"action":"reports"}`（対応済みも含めるなら `{"action":"reports","all":true}`） |
| バグ報告を対応済みにする | `{"action":"doneReport","reportId":"uyqahkm6"}`（戻すなら `undoReport`） |

バグ報告の一覧は、そのまま Claude に貼れば調べられる。手牌は `hand`（13枚）と `draw`（ツモ）に `2233444p5p1s2299s` の形で入っている。
読みやすくしたいときは、末尾に `| python3 -m json.tool` を付ける。

## 8. 必要になったら（今はやらなくていい）
- **独自ドメイン**：ドメインを買ったら、Pages プロジェクトの **Custom domains** から追加する。
- **端末の引き継ぎ**：名前は端末のブラウザに結び付いている。機種変更などで引き継ぎたい声が出たら、引き継ぎコードを作る。

## 困ったとき
| 症状 | 確認すること |
|---|---|
| `git push` で `rejected` | GitHub 側で README などを付けてリポジトリを作っていないか。付けた場合は、リポジトリを作り直すのが早い |
| Cloudflare のビルドが失敗する | ビルドコマンドとビルド出力ディレクトリの綴り（`node scripts/build-site.js` と `site`） |
| サイトは開くが牌の画像が出ない | `tiles/` が push されているか（GitHub のページで確認） |
| 一覧に GitHub のリポジトリが出ない | GitHub の **Settings → Applications → Cloudflare Workers and Pages → Configure** で、`xyz-training` にチェックが入っているか |
