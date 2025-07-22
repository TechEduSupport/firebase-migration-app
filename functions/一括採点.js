
// Vision APIでのOCR関数（submitReportの例より流用）
function getTextFromImage(imageBlob, visionApiKey) {
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
    const base64Image = Utilities.base64Encode(imageBlob.getBytes());
    const requestBody = {
        "requests": [
            {
                "image": {
                    "content": base64Image
                },
                "features": [
                    {
                        "type": "TEXT_DETECTION"
                    }
                ]
            }
        ]
    };

    const options = {
        'method': 'post',
        'contentType': 'application/json',
        'payload': JSON.stringify(requestBody),
        'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(visionApiUrl, options);
    const responseText = response.getContentText();
    const responseJson = JSON.parse(responseText);

    if (responseJson.responses && responseJson.responses[0] && responseJson.responses[0].fullTextAnnotation) {
        return responseJson.responses[0].fullTextAnnotation.text;
    } else if (responseJson.responses && responseJson.responses[0] && responseJson.responses[0].error) {
        const errorMsg = responseJson.responses[0].error.message;
        throw new Error('エラー: ' + errorMsg);
    } else {
        throw new Error('エラーによりテキストを取得できませんでした。');
    }
}