export type QuestionType = "single" | "multiple" | "true_false" | "fill_blank" | "match";

export interface QuestionOption {
  id: string;
  content: string;
  is_correct: boolean;
}

/** A pair for "match" (drag-drop) questions: left column ↔ right column. */
export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id: string;
  exam_id: string;
  type: QuestionType;
  content: string;
  points: number;
  explanation?: string;
  options: QuestionOption[];
  // For fill_blank: list of acceptable answers (case-insensitive)
  accepted_answers?: string[];
  // For match: the correct pairings — student must drag right items to match left
  pairs?: MatchPair[];
  /** Optional media attached to the question stem (image or video). */
  media?: QuestionMedia;
  /** Optional hint shown when the student taps the lightbulb icon. */
  hint?: string;
}

/** Media that can be attached to a question (image or video). */
export interface QuestionMedia {
  type: "image" | "video";
  /** Public URL or remote source. For demo we use Unsplash / sample MP4s. */
  src: string;
  /** Optional poster image for videos. */
  poster?: string;
  /** Alt text / short caption shown under the media. */
  alt?: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  topic: string;
  duration_minutes: number;
  difficulty: "Cơ bản" | "Trung bình" | "Nâng cao";
  attempts_count: number;
  created_by: string;
  cover_emoji: string;
  questions: Question[];
}

export interface User {
  id: string;
  display_name: string;
  avatar: string; // emoji
  role: "admin" | "teacher" | "student";
}

export interface AttemptAnswer {
  question_id: string;
  selected_option_ids?: string[];
  text_answer?: string;
  is_correct: boolean;
  earned_points: number;
}

export interface Attempt {
  id: string;
  user_id: string;
  exam_id: string;
  score: number; // 0..100
  max_score: number;
  earned_score: number;
  duration_seconds: number;
  submitted_at: string; // ISO
  answers: AttemptAnswer[];
}

export const CURRENT_USER: User = {
  id: "u-me",
  display_name: "Bạn",
  avatar: "🧑‍💻",
  role: "admin", // để demo cả tính năng admin
};

export const USERS: User[] = [
  CURRENT_USER,
  { id: "u-1", display_name: "Minh Anh", avatar: "👩‍🎓", role: "student" },
  { id: "u-2", display_name: "Quang Huy", avatar: "🧑‍🎓", role: "student" },
  { id: "u-3", display_name: "Thu Hà", avatar: "👩", role: "student" },
  { id: "u-4", display_name: "Đức Long", avatar: "🧑", role: "student" },
  { id: "u-5", display_name: "Phương Linh", avatar: "👩‍🏫", role: "teacher" },
  { id: "u-6", display_name: "Tuấn Kiệt", avatar: "🧑‍🚀", role: "student" },
  { id: "u-7", display_name: "Mai Chi", avatar: "👩‍🔬", role: "student" },
  { id: "u-8", display_name: "Bảo Nam", avatar: "🧑‍🎨", role: "student" },
  { id: "u-9", display_name: "Hà My", avatar: "👩‍💼", role: "student" },
  { id: "u-10", display_name: "Việt Anh", avatar: "🧑‍💼", role: "student" },
];

function q(
  id: string,
  exam_id: string,
  type: QuestionType,
  content: string,
  points: number,
  options: Array<[string, boolean]>,
  explanation?: string,
  accepted_answers?: string[],
  pairs?: MatchPair[],
  extras?: { media?: QuestionMedia; hint?: string },
): Question {
  return {
    id,
    exam_id,
    type,
    content,
    points,
    explanation,
    accepted_answers,
    pairs,
    media: extras?.media,
    hint: extras?.hint,
    options: options.map(([content, is_correct], idx) => ({
      id: `${id}-o${idx}`,
      content,
      is_correct,
    })),
  };
}

export const EXAMS: Exam[] = [
  {
    id: "exam-js-basics",
    title: "JavaScript căn bản",
    description: "Kiểm tra kiến thức nền tảng về biến, kiểu dữ liệu, hàm và scope trong JavaScript.",
    topic: "Lập trình",
    duration_minutes: 15,
    difficulty: "Cơ bản",
    attempts_count: 1284,
    created_by: "u-5",
    cover_emoji: "📘",
    questions: [
      q("q1", "exam-js-basics", "single", "Từ khóa nào KHÔNG dùng để khai báo biến trong JavaScript?", 10, [
        ["var", false], ["let", false], ["const", false], ["int", true],
      ], "`int` là từ khóa của các ngôn ngữ như C/Java, không tồn tại trong JavaScript."),
      q("q2", "exam-js-basics", "multiple", "Những giá trị nào sau đây là 'falsy' trong JavaScript?", 15, [
        ["0", true], ["\"\"", true], ["null", true], ["\"false\"", false], ["[]", false],
      ], "Falsy values: false, 0, \"\", null, undefined, NaN. Mảng rỗng `[]` và chuỗi `\"false\"` đều là truthy."),
      q("q3", "exam-js-basics", "true_false", "`typeof null` trả về \"object\".", 10, [
        ["Đúng", true], ["Sai", false],
      ], "Đây là một bug nổi tiếng có từ phiên bản đầu của JavaScript và vẫn được giữ lại để tương thích."),
      q("q4", "exam-js-basics", "fill_blank", "Phương thức để chuyển chuỗi JSON thành object là JSON.____", 10, [], "`JSON.parse()` chuyển chuỗi JSON sang object JavaScript.", ["parse"]),
      q("q5", "exam-js-basics", "single", "Kết quả của `typeof []` là gì?", 10, [
        ["\"array\"", false], ["\"object\"", true], ["\"list\"", false], ["\"undefined\"", false],
      ], "Trong JavaScript, mảng cũng là object."),
    ],
  },
  {
    id: "exam-react-hooks",
    title: "React Hooks chuyên sâu",
    description: "Bài kiểm tra về useState, useEffect, useMemo, useCallback và custom hooks.",
    topic: "Lập trình",
    duration_minutes: 20,
    difficulty: "Nâng cao",
    attempts_count: 642,
    created_by: "u-5",
    cover_emoji: "⚛️",
    questions: [
      q("rh1", "exam-react-hooks", "single", "Hook nào dùng để ghi nhớ giá trị tính toán đắt giữa các lần render?", 10, [
        ["useState", false], ["useMemo", true], ["useEffect", false], ["useRef", false],
      ], "`useMemo` cache lại kết quả của hàm, chỉ tính lại khi dependency thay đổi."),
      q("rh2", "exam-react-hooks", "multiple", "Những điều nào ĐÚNG về useEffect?", 15, [
        ["Chạy sau mỗi lần render mặc định", true],
        ["Cleanup function chạy trước effect tiếp theo", true],
        ["Có thể return một Promise", false],
        ["Phụ thuộc vào dependency array", true],
      ], "useEffect không nên trả về Promise — chỉ trả về cleanup function hoặc undefined."),
      q("rh3", "exam-react-hooks", "true_false", "`useCallback(fn, deps)` tương đương `useMemo(() => fn, deps)`.", 10, [
        ["Đúng", true], ["Sai", false],
      ], "Cả hai đều memoize, nhưng useCallback chuyên cho hàm còn useMemo cho giá trị bất kỳ."),
      q("rh4", "exam-react-hooks", "fill_blank", "Hook ____ trả về một mutable ref object có property `.current`.", 10, [], "`useRef` thường dùng để truy cập DOM hoặc lưu giá trị không gây re-render.", ["useRef", "ref"]),
    ],
  },
  {
    id: "exam-css-flexbox",
    title: "CSS Flexbox & Grid",
    description: "Layout hiện đại với Flexbox và CSS Grid — căn chỉnh, phân bố không gian.",
    topic: "Thiết kế",
    duration_minutes: 12,
    difficulty: "Trung bình",
    attempts_count: 891,
    created_by: "u-5",
    cover_emoji: "🎨",
    questions: [
      q("cs1", "exam-css-flexbox", "single", "Thuộc tính nào căn chỉnh các flex item theo trục chính?", 10, [
        ["align-items", false], ["justify-content", true], ["align-content", false], ["flex-wrap", false],
      ]),
      q("cs2", "exam-css-flexbox", "multiple", "Những giá trị nào hợp lệ cho `display`?", 10, [
        ["flex", true], ["grid", true], ["block-flex", false], ["inline-flex", true],
      ]),
      q("cs3", "exam-css-flexbox", "fill_blank", "Để tạo grid 3 cột bằng nhau, dùng `grid-template-columns: repeat(3, ____);`", 10, [], "`1fr` là đơn vị fraction, chia đều không gian còn lại.", ["1fr"]),
    ],
  },
  {
    id: "exam-history-vn",
    title: "Lịch sử Việt Nam thế kỷ 20",
    description: "Các sự kiện lịch sử quan trọng từ 1900 đến 2000 — kháng chiến, thống nhất, đổi mới.",
    topic: "Lịch sử",
    duration_minutes: 25,
    difficulty: "Trung bình",
    attempts_count: 2103,
    created_by: "u-5",
    cover_emoji: "🇻🇳",
    questions: [
      q("h1", "exam-history-vn", "single", "Chiến thắng Điện Biên Phủ diễn ra vào năm nào?", 10, [
        ["1945", false], ["1954", true], ["1968", false], ["1975", false],
      ], undefined, undefined, undefined, {
        media: {
          type: "image",
          src: "https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=1200&q=80&auto=format&fit=crop",
          alt: "Tranh tư liệu về chiến dịch Điện Biên Phủ",
        },
        hint: "Chiến dịch kết thúc vào ngày 7/5 — chỉ vài tuần trước Hội nghị Genève.",
      }),
      q("h2", "exam-history-vn", "fill_blank", "Năm Việt Nam thống nhất đất nước là ____.", 10, [], "30/4/1975 — giải phóng miền Nam, thống nhất đất nước.", ["1975"]),
      q("h3", "exam-history-vn", "true_false", "Chính sách Đổi mới được khởi xướng tại Đại hội VI năm 1986.", 10, [
        ["Đúng", true], ["Sai", false],
      ], undefined, undefined, undefined, {
        hint: "Hãy nhớ giai đoạn cuối thập niên 1980 — khi nền kinh tế chuyển từ bao cấp sang thị trường.",
      }),
    ],
  },
  {
    id: "exam-math-derivative",
    title: "Đạo hàm và ứng dụng",
    description: "Đạo hàm cơ bản, quy tắc đạo hàm, khảo sát hàm số.",
    topic: "Toán học",
    duration_minutes: 30,
    difficulty: "Nâng cao",
    attempts_count: 567,
    created_by: "u-5",
    cover_emoji: "📐",
    questions: [
      q("m1", "exam-math-derivative", "single", "Đạo hàm của f(x) = x³ là?", 10, [
        ["3x²", true], ["x²", false], ["3x", false], ["x³/3", false],
      ]),
      q("m2", "exam-math-derivative", "fill_blank", "Đạo hàm của sin(x) là ____(x).", 10, [], "Đạo hàm cơ bản: (sin x)' = cos x.", ["cos"]),
      q("m3", "exam-math-derivative", "multiple", "Hàm số đạt cực trị tại điểm mà f'(x) = 0 và:", 10, [
        ["f''(x) > 0 → cực tiểu", true],
        ["f''(x) < 0 → cực đại", true],
        ["f''(x) = 0 → luôn có cực trị", false],
        ["Đạo hàm đổi dấu khi qua điểm đó", true],
      ]),
    ],
  },
  {
    id: "exam-english-grammar",
    title: "English Grammar — Tenses",
    description: "Mastery test on the 12 English tenses with practical examples.",
    topic: "Ngoại ngữ",
    duration_minutes: 18,
    difficulty: "Trung bình",
    attempts_count: 1567,
    created_by: "u-5",
    cover_emoji: "🇬🇧",
    questions: [
      q("e1", "exam-english-grammar", "single", "Choose the correct sentence:", 10, [
        ["She have been working since 9am.", false],
        ["She has been working since 9am.", true],
        ["She is been working since 9am.", false],
        ["She been working since 9am.", false],
      ]),
      q("e2", "exam-english-grammar", "fill_blank", "By next year, I ____ graduated. (will have / have)", 10, [], "Future Perfect: will have + V3.", ["will have"]),
      q("e3", "exam-english-grammar", "true_false", "\"I am knowing him for years\" is grammatically correct.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "'Know' là stative verb, không dùng dạng tiếp diễn. Đúng phải là: I have known him for years."),
    ],
  },
  // ============================================================
  // Bộ đề chuyên biệt theo từng DẠNG câu hỏi trắc nghiệm
  // (mỗi đề chỉ chứa duy nhất một dạng — phục vụ demo /exams)
  // ============================================================
  {
    id: "exam-single-choice",
    title: "Trắc nghiệm 1 đáp án — Văn hóa đại chúng",
    description:
      "Bộ đề chỉ gồm các câu hỏi chọn MỘT đáp án đúng. Phù hợp để làm quen với dạng trắc nghiệm cổ điển nhất.",
    topic: "Tổng hợp",
    duration_minutes: 10,
    difficulty: "Cơ bản",
    attempts_count: 423,
    created_by: "u-5",
    cover_emoji: "🎯",
    questions: [
      q("sc1", "exam-single-choice", "single", "Hành tinh nào lớn nhất trong Hệ Mặt Trời?", 10, [
        ["Trái Đất", false], ["Sao Mộc", true], ["Sao Thổ", false], ["Sao Hỏa", false],
      ], "Sao Mộc (Jupiter) là hành tinh lớn nhất, đường kính gấp ~11 lần Trái Đất.",
        undefined, undefined,
        {
          media: {
            type: "image",
            src: "https://images.unsplash.com/photo-1614314107768-6018061e5e1d?w=1200&q=80&auto=format&fit=crop",
            alt: "Ảnh các hành tinh trong Hệ Mặt Trời",
          },
          hint: "Hành tinh này có Vết Đỏ Lớn — một cơn bão khổng lồ tồn tại hàng trăm năm.",
        },
      ),
      q("sc2", "exam-single-choice", "single", "Tác giả của tiểu thuyết \"Số đỏ\" là ai?", 10, [
        ["Nam Cao", false], ["Vũ Trọng Phụng", true], ["Ngô Tất Tố", false], ["Nguyễn Công Hoan", false],
      ], "Vũ Trọng Phụng viết \"Số đỏ\" năm 1936, một kiệt tác trào phúng."),
      q("sc3", "exam-single-choice", "single", "Đơn vị đo cường độ dòng điện là gì?", 10, [
        ["Volt (V)", false], ["Watt (W)", false], ["Ampere (A)", true], ["Ohm (Ω)", false],
      ], "Ampere — đặt theo tên nhà vật lý người Pháp André-Marie Ampère."),
      q("sc4", "exam-single-choice", "single", "Thủ đô của Australia là thành phố nào?", 10, [
        ["Sydney", false], ["Melbourne", false], ["Canberra", true], ["Perth", false],
      ], "Canberra là thủ đô — không phải Sydney như nhiều người lầm tưởng."),
      q("sc5", "exam-single-choice", "single", "Ngôn ngữ lập trình nào ra đời sớm nhất?", 10, [
        ["Python", false], ["Fortran", true], ["C", false], ["Java", false],
      ], "Fortran (1957) — một trong những ngôn ngữ bậc cao đầu tiên."),
      q("sc6", "exam-single-choice", "single", "Bức tranh \"Mona Lisa\" hiện được trưng bày ở đâu?", 10, [
        ["Bảo tàng Anh", false], ["Bảo tàng Louvre", true], ["Bảo tàng Vatican", false], ["MoMA New York", false],
      ], "Mona Lisa được Leonardo da Vinci vẽ và hiện ở Louvre, Paris.",
        undefined, undefined,
        {
          media: {
            type: "video",
            src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            poster: "https://images.unsplash.com/photo-1565060299437-e29b3a833a08?w=1200&q=80&auto=format&fit=crop",
            alt: "Video giới thiệu bảo tàng nơi trưng bày tác phẩm",
          },
          hint: "Bảo tàng này nằm ở Paris, ngay bên bờ sông Seine.",
        },
      ),
    ],
  },
  {
    id: "exam-multiple-choice",
    title: "Trắc nghiệm nhiều đáp án — Khoa học tự nhiên",
    description:
      "Mỗi câu có thể có 2 hoặc nhiều phương án đúng. Bạn phải chọn ĐẦY ĐỦ tất cả đáp án đúng để được điểm.",
    topic: "Khoa học",
    duration_minutes: 15,
    difficulty: "Trung bình",
    attempts_count: 318,
    created_by: "u-5",
    cover_emoji: "🧪",
    questions: [
      q("mc1", "exam-multiple-choice", "multiple", "Những chất nào sau đây là kim loại?", 15, [
        ["Sắt (Fe)", true], ["Lưu huỳnh (S)", false], ["Đồng (Cu)", true], ["Nhôm (Al)", true], ["Cacbon (C)", false],
      ], "Sắt, Đồng, Nhôm là kim loại. Lưu huỳnh và Cacbon là phi kim."),
      q("mc2", "exam-multiple-choice", "multiple", "Những hành tinh nào thuộc nhóm hành tinh đá (terrestrial)?", 15, [
        ["Sao Thủy", true], ["Sao Kim", true], ["Sao Mộc", false], ["Trái Đất", true], ["Sao Hỏa", true],
      ], "Nhóm đá gồm 4 hành tinh trong cùng: Thủy, Kim, Trái Đất, Hỏa. Sao Mộc là hành tinh khí khổng lồ."),
      q("mc3", "exam-multiple-choice", "multiple", "Những phát biểu nào ĐÚNG về tế bào nhân thực?", 15, [
        ["Có nhân được bao bọc bởi màng nhân", true],
        ["Không có ribosome", false],
        ["Có các bào quan có màng như ty thể", true],
        ["DNA dạng vòng tự do trong tế bào chất", false],
        ["Có thể là động vật, thực vật, nấm", true],
      ], "Tế bào nhân thực có nhân hoàn chỉnh và bào quan có màng. DNA dạng vòng là đặc trưng của nhân sơ."),
      q("mc4", "exam-multiple-choice", "multiple", "Khí nào KHÔNG phải là khí nhà kính chính?", 15, [
        ["CO₂", false], ["O₂ (Oxy)", true], ["CH₄ (Metan)", false], ["N₂ (Nitơ)", true], ["H₂O (Hơi nước)", false],
      ], "Oxy và Nitơ KHÔNG phải khí nhà kính. CO₂, CH₄, hơi nước thì có."),
      q("mc5", "exam-multiple-choice", "multiple", "Định luật Newton thứ ba phát biểu rằng:", 15, [
        ["Mọi lực đều có một phản lực ngược chiều", true],
        ["Lực và phản lực có cùng độ lớn", true],
        ["Lực và phản lực tác dụng lên cùng một vật", false],
        ["Lực và phản lực tác dụng lên hai vật khác nhau", true],
      ], "Lực — phản lực luôn có cùng độ lớn, ngược chiều, và tác dụng lên hai vật khác nhau."),
    ],
  },
  {
    id: "exam-true-false",
    title: "Đúng / Sai — Kiến thức phổ thông",
    description:
      "Bộ đề chỉ gồm các câu Đúng/Sai. Đọc kỹ phát biểu và chọn câu trả lời chính xác.",
    topic: "Tổng hợp",
    duration_minutes: 8,
    difficulty: "Cơ bản",
    attempts_count: 587,
    created_by: "u-5",
    cover_emoji: "✅",
    questions: [
      q("tf1", "exam-true-false", "true_false", "Vạn Lý Trường Thành có thể nhìn thấy từ Mặt Trăng bằng mắt thường.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "Đây là một huyền thoại phổ biến nhưng SAI — các phi hành gia đã xác nhận không thể thấy bằng mắt thường từ Mặt Trăng."),
      q("tf2", "exam-true-false", "true_false", "Nước sôi ở 100°C ở mọi nơi trên Trái Đất.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "Nhiệt độ sôi của nước phụ thuộc áp suất khí quyển. Trên núi cao, nước sôi ở nhiệt độ thấp hơn."),
      q("tf3", "exam-true-false", "true_false", "Cá voi là động vật có vú, không phải cá.", 10, [
        ["Đúng", true], ["Sai", false],
      ], "Cá voi thở bằng phổi, đẻ con và nuôi con bằng sữa — đặc điểm của lớp Thú."),
      q("tf4", "exam-true-false", "true_false", "Albert Einstein là người phát minh ra bóng đèn.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "Thomas Edison mới là người làm cho bóng đèn dây tóc trở nên thương mại hóa. Einstein nổi tiếng với thuyết tương đối."),
      q("tf5", "exam-true-false", "true_false", "Sa mạc Sahara là sa mạc lớn nhất thế giới.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "Nếu tính cả sa mạc lạnh, Nam Cực mới là sa mạc lớn nhất. Sahara chỉ là sa mạc nóng lớn nhất."),
      q("tf6", "exam-true-false", "true_false", "Trái tim con người nằm hoàn toàn ở phía bên trái lồng ngực.", 10, [
        ["Đúng", false], ["Sai", true],
      ], "Trái tim nằm gần như chính giữa lồng ngực, hơi lệch sang trái một chút."),
      q("tf7", "exam-true-false", "true_false", "Mật ong không bao giờ bị hỏng nếu được bảo quản đúng cách.", 10, [
        ["Đúng", true], ["Sai", false],
      ], "Mật ong có độ ẩm thấp và pH axit, ngăn vi khuẩn phát triển. Mật ong trong lăng Pharaoh vẫn còn ăn được."),
    ],
  },
  {
    id: "exam-fill-blank",
    title: "Điền vào chỗ trống — Địa lý & Văn hóa",
    description:
      "Bộ đề gồm toàn câu hỏi điền từ. Câu trả lời được chấm không phân biệt hoa thường, có chấp nhận một số biến thể.",
    topic: "Địa lý",
    duration_minutes: 12,
    difficulty: "Trung bình",
    attempts_count: 261,
    created_by: "u-5",
    cover_emoji: "✍️",
    questions: [
      q("fb1", "exam-fill-blank", "fill_blank", "Sông dài nhất thế giới là sông ____.", 10, [],
        "Sông Nile (6.650 km) thường được công nhận là dài nhất, mặc dù sông Amazon đôi khi cũng được coi là dài hơn theo một số phép đo.",
        ["Nile", "Nin", "Nil"]),
      q("fb2", "exam-fill-blank", "fill_blank", "Thủ đô của Nhật Bản là ____.", 10, [],
        "Tokyo trở thành thủ đô từ năm 1868, thay thế Kyoto.",
        ["Tokyo", "Tô-ky-ô", "Đông Kinh"]),
      q("fb3", "exam-fill-blank", "fill_blank", "Đỉnh núi cao nhất thế giới là đỉnh ____.", 10, [],
        "Everest cao 8.849 m, nằm trên biên giới Nepal — Trung Quốc.",
        ["Everest", "Chomolungma", "Sagarmatha"]),
      q("fb4", "exam-fill-blank", "fill_blank", "Đại dương lớn nhất thế giới là ____ Dương.", 10, [],
        "Thái Bình Dương chiếm khoảng 1/3 bề mặt Trái Đất.",
        ["Thái Bình", "Thai Binh", "Pacific"]),
      q("fb5", "exam-fill-blank", "fill_blank", "Quốc gia có dân số đông nhất thế giới hiện nay là ____.", 10, [],
        "Ấn Độ đã vượt Trung Quốc về dân số từ năm 2023.",
        ["Ấn Độ", "An Do", "India"]),
      q("fb6", "exam-fill-blank", "fill_blank", "Đơn vị tiền tệ chính thức của Liên minh châu Âu là ____.", 10, [],
        "Euro (€) được sử dụng tại 20 trong 27 quốc gia thành viên EU.",
        ["Euro", "EUR", "€"]),
      q("fb7", "exam-fill-blank", "fill_blank", "Tháp Eiffel nằm tại thành phố ____.", 10, [],
        "Tháp Eiffel — biểu tượng của Paris, được xây dựng năm 1889.",
        ["Paris", "Pa-ri", "Pari"]),
    ],
  },
  {
    id: "exam-match-pairs",
    title: "Kéo thả ghép cặp — Quốc gia & Thủ đô",
    description:
      "Bộ đề chỉ gồm các câu hỏi kéo-thả. Bạn cần kéo từng thẻ bên phải và thả vào ô tương ứng bên trái để ghép cặp đúng.",
    topic: "Địa lý",
    duration_minutes: 12,
    difficulty: "Trung bình",
    attempts_count: 142,
    created_by: "u-5",
    cover_emoji: "🧩",
    questions: [
      q(
        "mp1", "exam-match-pairs", "match",
        "Ghép mỗi quốc gia với thủ đô tương ứng:",
        20, [],
        "Các thủ đô châu Á phổ biến — học viên cần phân biệt với các thành phố lớn khác.",
        undefined,
        [
          { id: "mp1-a", left: "Nhật Bản", right: "Tokyo" },
          { id: "mp1-b", left: "Hàn Quốc", right: "Seoul" },
          { id: "mp1-c", left: "Thái Lan", right: "Bangkok" },
          { id: "mp1-d", left: "Indonesia", right: "Jakarta" },
        ],
      ),
      q(
        "mp2", "exam-match-pairs", "match",
        "Ghép tác phẩm văn học với tác giả:",
        20, [],
        "Các tác phẩm văn học Việt Nam tiêu biểu giai đoạn 1930-1945.",
        undefined,
        [
          { id: "mp2-a", left: "Số đỏ", right: "Vũ Trọng Phụng" },
          { id: "mp2-b", left: "Tắt đèn", right: "Ngô Tất Tố" },
          { id: "mp2-c", left: "Chí Phèo", right: "Nam Cao" },
          { id: "mp2-d", left: "Việc làng", right: "Nguyễn Công Hoan" },
        ],
      ),
      q(
        "mp3", "exam-match-pairs", "match",
        "Ghép nguyên tố hóa học với ký hiệu:",
        15, [],
        "Các ký hiệu hóa học cơ bản — một số ký hiệu xuất phát từ tên Latin.",
        undefined,
        [
          { id: "mp3-a", left: "Vàng", right: "Au" },
          { id: "mp3-b", left: "Bạc", right: "Ag" },
          { id: "mp3-c", left: "Sắt", right: "Fe" },
          { id: "mp3-d", left: "Đồng", right: "Cu" },
          { id: "mp3-e", left: "Natri", right: "Na" },
        ],
      ),
      q(
        "mp4", "exam-match-pairs", "match",
        "Ghép phát minh với nhà phát minh:",
        15, [],
        "Những phát minh thay đổi lịch sử nhân loại.",
        undefined,
        [
          { id: "mp4-a", left: "Bóng đèn dây tóc", right: "Thomas Edison" },
          { id: "mp4-b", left: "Điện thoại", right: "Alexander Graham Bell" },
          { id: "mp4-c", left: "Thuyết tương đối", right: "Albert Einstein" },
          { id: "mp4-d", left: "World Wide Web", right: "Tim Berners-Lee" },
        ],
      ),
    ],
  },
];

function makeAttempts(): Attempt[] {
  const list: Attempt[] = [];
  // tạo attempts giả cho mỗi exam, mỗi user
  EXAMS.forEach((exam) => {
    USERS.forEach((user, ui) => {
      const max = exam.questions.reduce((s, q) => s + q.points, 0);
      const numAttempts = (ui % 3) + 1;
      for (let i = 0; i < numAttempts; i++) {
        const seed = (exam.id.length + ui * 7 + i * 13) % 100;
        const ratio = 0.4 + (seed / 100) * 0.6; // 40-100%
        const earned = Math.round(max * ratio);
        const dur = exam.duration_minutes * 60 - (seed * 5);
        const daysAgo = (ui * 2 + i) % 30;
        list.push({
          id: `att-${exam.id}-${user.id}-${i}`,
          user_id: user.id,
          exam_id: exam.id,
          earned_score: earned,
          max_score: max,
          score: Math.round((earned / max) * 100),
          duration_seconds: Math.max(60, dur),
          submitted_at: new Date(Date.now() - daysAgo * 86400000 - i * 3600000).toISOString(),
          answers: [],
        });
      }
    });
  });
  return list;
}

export const ATTEMPTS: Attempt[] = makeAttempts();

export function getExamById(id: string): Exam | undefined {
  return EXAMS.find((e) => e.id === id);
}

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function getAttemptById(id: string): Attempt | undefined {
  return ATTEMPTS.find((a) => a.id === id);
}

/** Top scores per user for an exam, sorted desc by score then asc by duration. */
export function getLeaderboard(examId: string, limit = 50) {
  const byUser = new Map<string, Attempt>();
  ATTEMPTS.filter((a) => a.exam_id === examId).forEach((a) => {
    const cur = byUser.get(a.user_id);
    if (!cur || a.score > cur.score || (a.score === cur.score && a.duration_seconds < cur.duration_seconds)) {
      byUser.set(a.user_id, a);
    }
  });
  return Array.from(byUser.values())
    .sort((x, y) => y.score - x.score || x.duration_seconds - y.duration_seconds)
    .slice(0, limit)
    .map((a, idx) => ({ rank: idx + 1, attempt: a, user: getUserById(a.user_id)! }));
}

export function getMyAttempts(examId?: string) {
  return ATTEMPTS.filter(
    (a) => a.user_id === CURRENT_USER.id && (!examId || a.exam_id === examId),
  ).sort((a, b) => +new Date(b.submitted_at) - +new Date(a.submitted_at));
}

/** Exams created by a specific teacher/admin. */
export function getExamsByCreator(userId: string): Exam[] {
  return EXAMS.filter((e) => e.created_by === userId);
}

/** Aggregate stats for a single exam (for admin/teacher dashboards). */
export function getExamStats(examId: string) {
  const list = ATTEMPTS.filter((a) => a.exam_id === examId);
  if (list.length === 0) return { total: 0, avgScore: 0, uniqueUsers: 0, passRate: 0 };
  const total = list.length;
  const avgScore = Math.round(list.reduce((s, a) => s + a.score, 0) / total);
  const uniqueUsers = new Set(list.map((a) => a.user_id)).size;
  const passRate = Math.round((list.filter((a) => a.score >= 60).length / total) * 100);
  return { total, avgScore, uniqueUsers, passRate };
}

/** Best score per user across all exams (for teacher's student panel). */
export function getStudentSummaries() {
  return USERS.filter((u) => u.role === "student").map((user) => {
    const userAttempts = ATTEMPTS.filter((a) => a.user_id === user.id);
    const examIds = new Set(userAttempts.map((a) => a.exam_id));
    const avg = userAttempts.length
      ? Math.round(userAttempts.reduce((s, a) => s + a.score, 0) / userAttempts.length)
      : 0;
    const last = userAttempts.sort(
      (a, b) => +new Date(b.submitted_at) - +new Date(a.submitted_at),
    )[0];
    return {
      user,
      examsTaken: examIds.size,
      attempts: userAttempts.length,
      avgScore: avg,
      lastActive: last?.submitted_at,
    };
  });
}

export const TOPICS = Array.from(new Set(EXAMS.map((e) => e.topic)));

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Deterministic date formatter (UTC) to avoid SSR/CSR hydration mismatch. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hh}:${mi}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
 * KPI helpers (for /admin/kpi page)
 * ----------------------------------------------------------------
 * Mỗi user có một KPI mục tiêu (số bài thi cần hoàn thành) theo
 * ngày / tuần / tháng. Một bài thi được tính "đạt" nếu score >= 60.
 * "Ngày đi làm" = số ngày khác nhau user có ít nhất 1 attempt
 * trong 30 ngày gần nhất.
 * ============================================================ */

export interface UserKpi {
  user: User;
  /** Mục tiêu KPI */
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  /** Hoàn thành thực tế trong khoảng thời gian tương ứng */
  dailyDone: number;
  weeklyDone: number;
  monthlyDone: number;
  /** Số ngày đi làm khác nhau trong 30 ngày qua */
  workDays: number;
  /** Tỉ lệ bài thi đạt (score >= 60) trên tổng số bài thi */
  passRate: number;
  /** Tổng số bài thi đã làm (mọi thời gian) */
  totalAttempts: number;
  /** Tổng KPI hoàn thành = dailyDone + weeklyDone + monthlyDone đã chuẩn hoá %. */
  kpiScore: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Trả về danh sách KPI cho mọi user (admin xem toàn hệ thống). */
export function getUserKpis(): UserKpi[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const startOfDay = now - 1 * DAY;
  const startOfWeek = now - 7 * DAY;
  const startOfMonth = now - 30 * DAY;

  return USERS.map((user, idx) => {
    const attempts = ATTEMPTS.filter((a) => a.user_id === user.id);
    const passed = attempts.filter((a) => a.score >= 60).length;
    const passRate = attempts.length
      ? Math.round((passed / attempts.length) * 100)
      : 0;

    const within = (sinceMs: number) =>
      attempts.filter((a) => +new Date(a.submitted_at) >= sinceMs).length;

    const dailyDone = within(startOfDay);
    const weeklyDone = within(startOfWeek);
    const monthlyDone = within(startOfMonth);

    // Mục tiêu KPI khác nhau theo vai trò + một chút biến thiên theo idx
    const base =
      user.role === "admin" ? 4 : user.role === "teacher" ? 3 : 2;
    const dailyTarget = base + (idx % 2);
    const weeklyTarget = dailyTarget * 5;
    const monthlyTarget = dailyTarget * 20;

    const days = new Set<string>();
    attempts.forEach((a) => {
      if (+new Date(a.submitted_at) >= startOfMonth) {
        days.add(dayKey(a.submitted_at));
      }
    });
    const workDays = days.size;

    const norm = (done: number, target: number) =>
      target ? Math.min(100, Math.round((done / target) * 100)) : 0;
    const kpiScore = Math.round(
      (norm(dailyDone, dailyTarget) +
        norm(weeklyDone, weeklyTarget) +
        norm(monthlyDone, monthlyTarget)) /
        3,
    );

    return {
      user,
      dailyTarget,
      weeklyTarget,
      monthlyTarget,
      dailyDone,
      weeklyDone,
      monthlyDone,
      workDays,
      passRate,
      totalAttempts: attempts.length,
      kpiScore,
    };
  });
}

/* ============================================================
 * Attendance & KPI điểm (chi tiết theo từng user)
 * ----------------------------------------------------------------
 * Mỗi ngày trong 30 ngày gần nhất user có 1 trong các trạng thái:
 *   - "work"        : đi làm bình thường (có giờ vào/ra + records)
 *   - "leave_paid"  : nghỉ có phép
 *   - "leave_unpaid": nghỉ không phép
 *   - "weekend"     : cuối tuần (T7 / CN)
 * Đồng thời sinh "KPI điểm" (vd 800/ngày) — tổng điểm record xử lý
 * trong ngày, độc lập với KPI bài thi ở getUserKpis().
 * ============================================================ */

export type AttendanceStatus =
  | "work"
  | "leave_paid"
  | "leave_unpaid"
  | "weekend";

export interface AttendanceDay {
  /** YYYY-MM-DD (UTC) */
  date: string;
  status: AttendanceStatus;
  /** Giờ vào (HH:mm) — chỉ có khi status = "work" */
  checkIn?: string;
  /** Giờ ra (HH:mm) — chỉ có khi status = "work" */
  checkOut?: string;
  /** Số record (đầu việc / xử lý) trong ngày */
  records: number;
  /** KPI điểm đạt trong ngày (vd 720) */
  kpiPoints: number;
  /** Ghi chú (lý do nghỉ phép, ốm…) */
  note?: string;
}

export interface UserAttendanceSummary {
  /** Mục tiêu KPI điểm / ngày (vd 800) */
  dailyKpiTarget: number;
  /** KPI điểm hôm nay đã đạt */
  todayKpiPoints: number;
  /** Số record hôm nay */
  todayRecords: number;
  /** Tổng KPI điểm đã đạt trong tháng (30 ngày qua) */
  monthKpiPoints: number;
  /** Mục tiêu KPI điểm cả tháng */
  monthKpiTarget: number;
  /** Số ngày nghỉ trong 30 ngày qua */
  leavePaid: number;
  leaveUnpaid: number;
  /** Số ngày đi làm thực tế (status = "work") */
  workDays: number;
  /** Lịch 30 ngày gần nhất, mới nhất ở đầu */
  days: AttendanceDay[];
}

/** Hash deterministic theo userId để mock ổn định, không lệ thuộc Date.now. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function seeded(seed: number) {
  let x = seed || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0xffffffff;
  };
}

function fmtDay(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const LEAVE_REASONS = [
  "Nghỉ ốm có đơn",
  "Việc gia đình",
  "Khám sức khoẻ định kỳ",
  "Phép năm",
];

/** Sinh dữ liệu chấm công + KPI điểm 30 ngày gần nhất cho 1 user. */
export function getUserAttendance(userId: string): UserAttendanceSummary {
  const user = USERS.find((u) => u.id === userId);
  const rand = seeded(hashStr(userId));

  // Mục tiêu KPI điểm theo vai trò
  const dailyKpiTarget =
    user?.role === "admin" ? 1000 : user?.role === "teacher" ? 900 : 800;

  const days: AttendanceDay[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let leavePaid = 0;
  let leaveUnpaid = 0;
  let workDays = 0;
  let monthKpiPoints = 0;
  let todayKpiPoints = 0;
  let todayRecords = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay(); // 0 = CN, 6 = T7
    const isWeekend = dow === 0 || dow === 6;
    const r = rand();

    let status: AttendanceStatus;
    if (isWeekend) status = "weekend";
    else if (r < 0.06) status = "leave_unpaid";
    else if (r < 0.16) status = "leave_paid";
    else status = "work";

    let checkIn: string | undefined;
    let checkOut: string | undefined;
    let records = 0;
    let kpiPoints = 0;
    let note: string | undefined;

    if (status === "work") {
      const inH = 8 + Math.floor(rand() * 2);
      const inM = Math.floor(rand() * 30);
      const outH = 17 + Math.floor(rand() * 2);
      const outM = Math.floor(rand() * 60);
      checkIn = `${String(inH).padStart(2, "0")}:${String(inM).padStart(2, "0")}`;
      checkOut = `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
      // KPI 0.6×–1.2× target, records ~ kpi/40
      kpiPoints = Math.round(dailyKpiTarget * (0.6 + rand() * 0.6));
      records = Math.round(kpiPoints / (35 + rand() * 15));
      workDays += 1;
      monthKpiPoints += kpiPoints;
    } else if (status === "leave_paid") {
      leavePaid += 1;
      note = LEAVE_REASONS[Math.floor(rand() * LEAVE_REASONS.length)];
    } else if (status === "leave_unpaid") {
      leaveUnpaid += 1;
      note = "Nghỉ không phép";
    }

    if (i === 0) {
      todayKpiPoints = kpiPoints;
      todayRecords = records;
    }

    days.push({
      date: fmtDay(d),
      status,
      checkIn,
      checkOut,
      records,
      kpiPoints,
      note,
    });
  }

  return {
    dailyKpiTarget,
    todayKpiPoints,
    todayRecords,
    monthKpiPoints,
    monthKpiTarget: dailyKpiTarget * 22, // ~22 ngày làm việc / tháng
    leavePaid,
    leaveUnpaid,
    workDays,
    days,
  };
}