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

// public/js/ui.js (新規作成)

document.addEventListener('DOMContentLoaded', () => {
  // ユーザーメニューの開閉ロジック
  const userMenuButton = document.getElementById('userMenuButton');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  if (userMenuButton) {
    userMenuButton.addEventListener('click', () => {
      userMenuDropdown.classList.toggle('show');
    });
  }

  // メニュー外をクリックしたら閉じる
  window.addEventListener('click', (event) => {
    if (userMenuButton && !userMenuButton.contains(event.target)) {
      userMenuDropdown.classList.remove('show');
    }
  });
});

/**
 * メインコンテンツの表示を切り替える関数
 * @param {string} viewId 表示するビューのID ('view-list' or 'view-create')
 */
function showView(viewId) {
  // すべてのビューを非表示に
  document.querySelectorAll('.main-view').forEach(view => {
    view.classList.remove('active-view');
  });
  // 対象のビューのみ表示
  document.getElementById(viewId).classList.add('active-view');
}

/**
 * 授業選択モーダルを開く
 */
function openSubjectSelectModal() {
  document.getElementById('subject-select-modal').classList.add('is-open');
}

/**
 * 授業選択モーダルを閉じる
 */
function closeSubjectSelectModal() {
  document.getElementById('subject-select-modal').classList.remove('is-open');
}