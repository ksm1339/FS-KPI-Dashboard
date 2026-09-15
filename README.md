# FSG KPI 대시보드 — GitHub Pages 배포 패키지

이 폴더를 GitHub 저장소(repository)에 올리면, 브라우저 주소 하나로 언제 어디서든
(비밀번호 입력 후) 볼 수 있는 KPI 대시보드가 자동으로 만들어집니다.
매주 Raw 데이터 엑셀 파일만 교체해서 올리면 나머지는 자동으로 갱신됩니다.

완전 무료로 동작하도록 설계되어 있습니다 (GitHub 무료 계정 + GitHub Pages + GitHub Actions).

---

## 왜 원본 엑셀 파일이 암호화되어 있나요?

무료로 GitHub Pages를 쓰려면 저장소가 **공개(Public)** 여야 합니다. 대시보드 화면 자체는
비밀번호로 잠겨 있지만, 만약 원본 엑셀 파일(`raw.xlsx`, `master.xlsx`)을 그대로 저장소에
올리면 비밀번호 없이도 누구나 그 파일을 직접 내려받아 전 직원 실명 데이터를 볼 수 있게 됩니다.

그래서 이 패키지는 원본 엑셀 파일을 저장소에 직접 올리지 않고, **암호화된 형태
(`data/raw.xlsx.enc`, `reference/master.xlsx.enc`)** 로만 올립니다. 이 파일들은 비밀번호
없이는 열어볼 수 없는 암호문이며, 대시보드를 빌드할 때만 GitHub 서버 내부에서 잠깐
복호화되었다가 사라집니다. 저장소 어디에도 평문 엑셀 파일은 남지 않습니다.

즉, 비밀번호 하나로 (1) 완성된 대시보드 화면과 (2) 원본 데이터 파일 모두를 보호합니다.

---

## 처음 설정하는 방법 (한 번만 하면 됩니다)

### 1. GitHub 계정 만들기
[github.com](https://github.com) 접속 → Sign up → 이메일로 무료 계정 생성.

### 2. 새 저장소 만들기
로그인 후 오른쪽 위 **+** → **New repository** 클릭.
- Repository name: 예) `fsg-kpi-dashboard`
- **Public** 선택 (Private 아님 — 무료 계정은 Private 저장소에서 GitHub Pages를 쓸 수 없습니다)
- 나머지는 기본값 그대로 두고 **Create repository**

### 3. 이 패키지 내용 업로드
방금 만든 저장소 페이지에서 **Add file → Upload files** 클릭.
이 zip 압축을 풀어서 나온 모든 파일/폴더(`data`, `reference`, `scripts`, `tools`,
`.github`, `requirements.txt`, `.gitignore`, `README.md`)를 통째로 끌어다 놓고
**Commit changes** 클릭. (git 프로그램 설치 불필요, 전부 웹 화면에서 됩니다.)

> `.github` 폴더처럼 이름이 점(.)으로 시작하는 폴더도 그대로 함께 올려야 자동 빌드가
> 동작합니다. 폴더째로 드래그해서 올리면 안의 파일들이 자동으로 인식됩니다.

### 4. 비밀번호를 GitHub에 등록 (Secret)
저장소의 **Settings → Secrets and variables → Actions** 로 이동 →
**New repository secret** 클릭.
- Name: `DASHBOARD_PASSWORD`
- Secret: 아래 "처음 비밀번호" 값을 입력 (원하면 다른 값으로 바꿔도 됩니다. 단, 이 값이
  `data/raw.xlsx.enc` / `reference/master.xlsx.enc` 를 암호화할 때 쓴 비밀번호와
  **반드시 똑같아야** 합니다.)
- **Add secret** 클릭

이 값은 저장소 어디에서도 보이지 않고, GitHub Actions가 빌드할 때만 내부적으로 사용됩니다.

**처음 비밀번호: `k18PPVu2uqSX`**

(이 zip에 들어있는 `data/raw.xlsx.enc`, `reference/master.xlsx.enc` 는 이미 이 비밀번호로
암호화되어 있습니다. 3번 단계에서 그대로 업로드했다면 이 비밀번호를 그대로 Secret에
입력하면 됩니다.)

### 5. GitHub Pages 활성화
저장소의 **Settings → Pages** 로 이동 → **Build and deployment → Source** 를
**GitHub Actions** 로 선택합니다. (브랜치를 고르는 옛날 방식이 아니라 "GitHub Actions"
항목을 선택하는 것이 중요합니다.)

### 6. 첫 배포 확인
3번 단계에서 파일을 올리면 자동으로 빌드가 시작됩니다. 저장소 상단의 **Actions** 탭에서
"Build and deploy KPI dashboard" 작업이 실행되는 것을 볼 수 있습니다 (보통 1~2분 소요).
초록색 체크가 뜨면 완료된 것입니다.

완료 후 **Settings → Pages** 페이지 상단에 사이트 주소가 표시됩니다. 형식은 보통:

```
https://<GitHub 아이디>.github.io/<저장소 이름>/
```

이 주소로 접속하면 비밀번호 입력 화면이 나오고, `k18PPVu2uqSX` 를 입력하면 대시보드가
열립니다. 이 주소를 즐겨찾기에 등록해두고 팀원들에게 (비밀번호와 함께) 공유하면 됩니다.

---

## 매주 데이터 업데이트하는 방법

매주 새로운 Raw 데이터 엑셀 파일을 받으면 아래 3단계만 반복하면 됩니다. (git 프로그램,
개발 지식 전혀 필요 없습니다.)

1. **`tools/encrypt_source.html` 파일을 더블클릭해서 브라우저로 엽니다.**
   (저장소에서 내려받아 컴퓨터에 저장해두고 계속 재사용하면 됩니다. 이 페이지는 인터넷에
   아무것도 전송하지 않고, 여는 즉시 오프라인으로도 동작합니다.)

2. 화면에서:
   - "매주 받는 Raw 데이터 엑셀 파일" 선택 (기본값)
   - 새로 받은 엑셀 파일 선택
   - 비밀번호 입력 (Secret에 등록한 것과 동일한 값, 기본 `k18PPVu2uqSX`)
   - **암호화 후 다운로드** 클릭 → `raw.xlsx.enc` 파일이 다운로드됩니다.

3. **GitHub 저장소의 `data` 폴더로 이동** → `raw.xlsx.enc` 파일 클릭 → 연필 아이콘
   (Edit) 옆 **⋯ (또는 우측 상단) → Upload files** 로 방금 다운로드된 `raw.xlsx.enc` 를
   올려서 기존 파일을 교체 → **Commit changes**.

파일이 올라가는 순간(=commit 되는 순간) 자동으로 대시보드가 새로 빌드되어 몇 분 안에
같은 주소에 반영됩니다. **Actions** 탭에서 진행 상황을 확인할 수 있습니다.

> 기준정보 파일(구성원 명단, 거래처 목록 등, `reference/master.xlsx.enc`)은 조직 개편 등
> 특별한 경우에만 바뀌므로, 그럴 때만 위와 같은 방식으로 "기준정보 마스터 파일"을 선택해서
> 같은 절차를 반복하면 됩니다.

---

## 비밀번호를 바꾸고 싶다면

비밀번호는 (1) 대시보드 화면 잠금과 (2) 원본 데이터 파일 암호화에 동시에 쓰이므로,
바꿀 때는 아래 두 곳을 **함께** 바꿔야 합니다.

1. `tools/encrypt_source.html` 로 `data/raw.xlsx.enc` 와 `reference/master.xlsx.enc` 를
   **새 비밀번호로 다시 암호화**해서 두 파일 모두 저장소에 다시 업로드
2. 저장소 **Settings → Secrets and variables → Actions** 에서 `DASHBOARD_PASSWORD`
   값을 새 비밀번호로 수정

두 곳이 서로 다르면 빌드가 실패합니다 (Actions 탭에 오류가 표시됩니다).

---

## 폴더 구성

```
data/raw.xlsx.enc            매주 교체하는 Raw 데이터 (암호화됨)
reference/master.xlsx.enc     구성원/거래처 등 기준정보 (암호화됨, 거의 안 바뀜)
scripts/decrypt_sources.py    빌드 1단계: 위 두 파일을 복호화
scripts/extract.py            빌드 2단계: 엑셀 데이터를 집계
scripts/finalize.py           빌드 3단계: 대시보드용 데이터로 가공
scripts/build.py              전체 과정을 순서대로 실행 + 최종 결과 암호화 + HTML 생성
scripts/template.html         대시보드 화면의 뼈대 (잠금 화면 포함)
scripts/app.js                대시보드 화면 로직 (차트, 표 등)
tools/encrypt_source.html     매주 새 데이터를 암호화할 때 쓰는 도구 (오프라인 브라우저 도구)
.github/workflows/deploy.yml  자동 빌드/배포 설정 (GitHub Actions)
docs/                         빌드 결과물 (자동 생성됨, 저장소에는 올라가지 않음)
```

## 참고

- 대시보드는 기술 요청/학술 요청 KPI 가중치, Sysmex Korea 회계연도(4월~익년 3월),
  500분 초과 MTTR 이상치 제외, 4개 팀 동일한 재방문율/FTFR 계산식 등 기존에 검증한
  로직을 그대로 사용합니다. `김민결` 님은 데이터 집계에서 제외되어 있습니다.
- 데이터 기준일은 매 빌드 시점(=파일을 올린 시점)으로 자동 갱신됩니다.
- 사이트 자체는 누구나 URL로 접속을 "시도"할 수 있지만, 비밀번호 없이는 실제 데이터를
  전혀 볼 수 없습니다 (AES-256-GCM 암호화, 서버가 아니라 접속한 사람의 브라우저에서
  직접 복호화).
