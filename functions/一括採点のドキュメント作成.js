// ▼ 第4引数として emailAddress を受け取るように変更
function sendResultEmail(teacherLoginId, downloadUrl, isError, emailAddress) {
  // ここではシートを参照せずに、引数で受け取った emailAddress をそのまま使う

  if (!emailAddress) {
    Logger.log('メール送信エラー: 送信先メールアドレスが無効です。');
    return;
  }

  let subject, body;
  if (isError) {
    subject = '手書き採点アシスタントの採点が終了しました（採点に失敗しました）';
    body = '※このメールは自動送信されています。\n\n' +
           '手書き採点アシスタントをご利用いただきありがとうございます。\n' +
           '申し訳ございませんが、何らかのエラーにより一括採点処理に失敗しました。\n' +
           'お手数ですが、再度お試しください。\n' +
           '2度以上失敗している場合は、tech@ai-eva.comまでご連絡ください。\n\n' +
           '合同会社 EduSupport';
  } else {
    subject = '手書き採点アシスタントの採点が終了しました（採点に成功しました）';
    body = '※このメールは自動送信されています（本メールにはご返信いただけません）。\n\n' +
           '手書き採点アシスタントをご利用いただきありがとうございます。\n' +
           '一括採点が完了しましたので、以下のリンクよりzipフォルダをダウンロードしてください。\n' +
           downloadUrl + '\n\n' +
           'リンクは24時間有効です。\n' +
           'このリンクは第三者には共有しないようご注意ください。\n\n' +
           '合同会社 EduSupport';
  }

  // ▼ 送信処理
  GmailApp.sendEmail(emailAddress, subject, body, {
    from: "noreply@ai-eva.com"
  });
}
