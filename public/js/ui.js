function showTopPage() {
  document.getElementById('student-login').style.display = 'none';
  document.getElementById('teacher-login').style.display = 'none';
  document.getElementById('top-page').style.display = 'block';
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