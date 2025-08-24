🏫 schools コレクション
学校そのものの情報を格納します。

ドキュメントID: (自動生成ID)

name: (文字列) 学校の正式名称 (例: 〇〇市立△△中学校)

schoolCode: (文字列) 人間が読める短いID (例: sunvalley)

createdAt: (タイムスタンプ) データ作成日時

---------------------------------

👤 users コレクション
システムを利用するすべてのユーザー（運営管理者、学校管理者、先生、生徒）の情報を格納します。

ドキュメントID: Firebase AuthenticationのUIDと必ず一致させます。

name: (文字列) ユーザーの氏名

email: (文字列) ログイン用のメールアドレス

role: (文字列) ユーザーの役割 (superadmin, schooladmin, teacher, student のいずれか)

schoolId: (文字列) 所属するschoolsコレクションのドキュメントID。superadminの場合はこのフィールドを持ちません。

studentNumber: (文字列) 生徒に割り振られた学生番号。生徒以外はこのフィールドを持ちません。

isActive: (真偽値) ユーザーアカウントが有効か。特にteacherロールで使用します。(デフォルト: true)

createdAt: (タイムスタンプ) データ作成日時

---------------------------------

📚 classes コレクション
クラス（組）の情報を格納します。「3年B組」のような物理的な集まりです。

ドキュメントID: (自動生成ID)

name: (文字列) 組の名前 (例: A組, B組)

year: (数値) 年度 (例: 2025)

isActive: (真偽値) アクティブなクラスか (デフォルト: true)

schoolId: (文字列) 所属するschoolsコレクションのドキュメントID

studentIds: (文字列の配列) このクラスに所属する生徒のUIDリスト

---------------------------------

📖 subjects コレクション
「授業」の情報を格納します。「2025年度 1年A組の数学」のような、具体的な授業インスタンスです。

ドキュメントID: (自動生成ID)

name: (文字列) 授業名 (例: 数学IA, 現代文)

description: (文字列) 授業内容の説明など（任意）

year: (数値) 年度 (例: 2025)

isActive: (真偽値) アクティブな授業か (デフォルト: true)

schoolId: (文字列) 所属するschoolsコレクションのドキュメントID

classId: (文字列) どのクラスに対する授業か (classesへの参照)

teacherIds: (文字列の配列) 担当教員のUIDリスト

studentIds: (文字列の配列) 受講生徒のUIDリスト

createdAt: (タイムスタンプ) データ作成日時

---------------------------------

📝 prompts コレクション
先生が作成する「課題」の情報を格納します。

ドキュメントID: (自動生成ID)

title: (文字列) 課題のタイトル

question: (文字列) 問題文

questionImageUrl: (文字列) 問題のファイルURL（任意）

subject: (文字列) 採点基準

isVisible: (真偽値) 生徒に表示するか

teacherId: (文字列) この課題を作成した先生のUID

subjectId: (文字列) どの授業の課題か (subjectsへの参照)

createdAt: (タイムスタンプ) データ作成日時

+ deadline: (タイムスタンプ) 提出締め切り日時

---------------------------------

📄 submissions コレクション
生徒が提出した解答の情報を格納します。

ドキュメントID: (自動生成ID)

studentId: (文字列) 提出した生徒のUID

promptId: (文字列) どの課題 (prompts) に対する提出か

classId: (文字列) どのクラスの課題として提出したか (classesへの参照)

answerImageUrl: (文字列) 生徒がアップロードした解答画像のURL

textAnswer: (文字列) 生徒がテキストで入力した解答

feedback: (文字列) AIによる採点結果のフィードバック

score: (数値) AIによる採点スコア

rating: (数値) 生徒による採点精度の評価（1〜5）

submittedAt: (タイムスタンプ) 提出日時