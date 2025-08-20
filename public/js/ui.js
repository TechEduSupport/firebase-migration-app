    function showTopPage() {
      document.getElementById('student-login').style.display = 'none';
      document.getElementById('teacher-login').style.display = 'none';
      document.getElementById('student-page').style.display = 'none';
      document.getElementById('teacher-page').style.display = 'none';
      document.getElementById('bulk-grading-page').style.display = 'none';
      document.getElementById('top-page').style.display = 'block';

      // トップページではログアウトボタンを非表示にする
      document.querySelectorAll('.logout-container').forEach(function(container) {
        container.style.display = 'none';
      });
    }

    function showStudentLogin() {
      document.getElementById('top-page').style.display = 'none';
      document.getElementById('student-login').style.display = 'block';
    }

    function showTeacherLogin() {
      document.getElementById('top-page').style.display = 'none';
      document.getElementById('teacher-login').style.display = 'block';
    }
    
        function showMessage(message) {
          console.log('showMessageが呼び出されました。メッセージ:', message);
          
      const messageElement = document.createElement('div');
      messageElement.innerText = message;
      messageElement.style.position = 'fixed';
      messageElement.style.top = '20px';
      messageElement.style.left = '50%';
      messageElement.style.transform = 'translateX(-50%)';
      messageElement.style.backgroundColor = '#333';
      messageElement.style.color = '#fff';
      messageElement.style.padding = '10px 20px';
      messageElement.style.borderRadius = '5px';
      messageElement.style.zIndex = '3000';
      document.body.appendChild(messageElement);
      setTimeout(function() {
        document.body.removeChild(messageElement);
      }, 3000);
    }
