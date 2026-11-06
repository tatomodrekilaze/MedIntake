/* Fake backend for working on the review screen without a server.
   All patients, IDs and phone numbers below are made up.

   review.js only loads this with ?fixture=1, and only on localhost.
   Extra URL switches:
     role=ADMIN|CLINICIAN|REVIEWER|CLINIC_STAFF   pick who is signed in
     auth=0                                       start signed out (key: "demo")
     gen=fail                                     make AI summary generation fail */
(function (root) {
  "use strict";

  const DATA = /*@DATA*/{"case":{"case":{"case_id":"MI-2026-0409","created_at":"2026-10-03T09:21:00Z","submitted_at":"2026-10-03T09:35:00Z","updated_at":"2026-10-03T09:35:00Z","language":"ka","status":"submitted","workflow":"new","patient":{"name":"გიორგი მაისურაძე","father_name":"ზურაბი","personal_id":"00000000004","dob":"1968-04-12","age":58,"sex":"male","phone":"+995 555 00 00 00","email":"giorgi.demo@example.com","address":"საცდელი ქ. 12","city":"თბილისი","insurance":"სადემონსტრაციო დაზღვევა"},"complaint":"მუცლის ზედა ნაწილში მტკივა, უკვე სამი დღეა და სულ უარესდება","headline":"3 დღის მუდმივი, მზარდი ეპიგასტრული ტკივილი NSAID-ის ფონზე; გამოსარიცხია მწვავე კორონარული სინდრომი","safety_level":"urgent","requires_escalation":false,"question_count":10,"completion_reason":"SUFFICIENT_INTAKE","assessment_status":"LEADING_CLINICAL_CONSIDERATION","leading_condition":"NSAID-ასოცირებული გასტრიტი / პეპტიური წყლული","review_status":"ready","decision_status":"none","context":[{"label":"ქრონიკული დაავადებები","value":"არტერიული ჰიპერტენზია","status":"stated"},{"label":"მუდმივი მედიკამენტები","value":"ამლოდიპინი (არარეგულარულად), იბუპროფენი","status":"stated"},{"label":"ალერგია","value":"","status":"negative"},{"label":"მოწევა","value":"დღეში ნახევარი კოლოფი","status":"stated"},{"label":"ალკოჰოლი","value":"","status":"uncertain"},{"label":"ორსულობა","value":"","status":"not_applicable"}],"answers":[{"id":"a1","n":1,"question":"როდის დაიწყო ტკივილი?","answer":"სამი დღის წინ, საღამოს, ვახშმის მერე.","note":"","topic":"დაწყება"},{"id":"a2","n":2,"question":"ტკივილი მუდმივია თუ მოდის და მიდის?","answer":"მუდმივია, ოღონდ ღამით უფრო მძაფრდება, ხანდახან მაღვიძებს კიდეც.","note":"","topic":"ხასიათი"},{"id":"a3","n":3,"question":"სად გრძნობთ ტკივილს ყველაზე მეტად? სადმე გადადის?","answer":"კუჭის არეში, შუაში. ხანდახან მარჯვნივ, ნეკნების ქვეშ გადადის.","note":"","topic":"ლოკალიზაცია"},{"id":"a4","n":4,"question":"გაქვთ გულისრევა ან ღებინება?","answer":"გულისრევა მაქვს, ღებინება არა.","note":"","topic":"თანმხლები სიმპტომები"},{"id":"a5","n":5,"question":"ტკივილი ძლიერდება ფიზიკური დატვირთვისას, მაგალითად კიბეზე ასვლისას? გულმკერდში, მკლავში ან ყბაში ხომ არ გადადის?","answer":"არ ვიცი, ამ დღეებში დიდად არ ვმოძრაობ. მკერდში ცოტა მიჭერს ხოლმე, მაგრამ მგონი კუჭისგანაა.","note":"პაციენტი მკერდის შეგრძნებას კუჭს მიაწერს.","topic":"გულ-სისხლძარღვთა სისტემა"},{"id":"a6","n":6,"question":"ჭამის შემდეგ ტკივილი იცვლება?","answer":"ცხიმიანის მერე უარესდება. ცოტა რომ ვჭამო, ცოტა მშველის.","note":"","topic":"კავშირი საკვებთან"},{"id":"a7","n":7,"question":"ცხელება, შემცივნება ან კანის და თვალის გაყვითლება შეგიმჩნევიათ?","answer":"ცხელება არ მქონია. გაყვითლება ვერ შევნიშნე.","note":"","topic":"ცხელება და სიყვითლე"},{"id":"a8","n":8,"question":"განავლის ფერი შეცვლილა? შავი ან ძალიან მუქი ხომ არ ყოფილა?","answer":"არა, ჩვეულებრივია.","note":"","topic":"სისხლდენის ნიშნები"},{"id":"a9","n":9,"question":"იღებთ ტკივილგამაყუჩებლებს, მაგალითად იბუპროფენს ან ასპირინს?","answer":"მუხლის გამო იბუპროფენს ვსვამ თითქმის ყოველდღე, ორი კვირაა.","note":"","topic":"მედიკამენტები"},{"id":"a10","n":10,"question":"გაქვთ წნევა, დიაბეტი, მაღალი ქოლესტერინი? ეწევით? ოჯახში ვინმეს ჰქონია გულის დაავადება?","answer":"წნევა მაქვს, წამალს ხანდახან ვსვამ. ვეწევი, დღეში ნახევარ კოლოფს. ოჯახზე არ ვიცი.","note":"","topic":"რისკ-ფაქტორები"}],"final_note":"ღამით ტკივილის გამო ვიღვიძებ. კიბეზე ასვლისას ცოტა ქოშინიც მაქვს, მაგრამ ეს ადრეც იყო.","contradictions":[{"text":"ერთ პასუხში ცხიმიანი საკვები ტკივილს აძლიერებს, იმავე პასუხში მცირე ულუფა ტკივილს ამსუბუქებს."}],"interview":{"question_count":10,"completion_reason":"SUFFICIENT_INTAKE","completion_label":"საკმარისი ინფორმაცია შეგროვდა"}},"review_status":"ready","review":{"version":1,"language":"ka","generated_by":"model","generated_at":"2026-10-03T09:36:10Z","headline":"3 დღის მუდმივი, მზარდი ეპიგასტრული ტკივილი NSAID-ის ფონზე; გამოსარიცხია მწვავე კორონარული სინდრომი","executive_summary":"58 წლის მამაკაცი, მწეველი, არტერიული ჰიპერტენზიით, უჩივის 3 დღის მუდმივ ეპიგასტრულ ტკივილს, რომელიც ღამით ძლიერდება და ზოგჯერ მარჯვენა ნეკნქვეშა არეში ირადიირებს; თან ახლავს გულისრევა ღებინების გარეშე. ორი კვირაა თითქმის ყოველდღე იღებს იბუპროფენს. ყველაზე სავარაუდოა NSAID-ასოცირებული გასტრიტი ან პეპტიური წყლული, ბილიარული პათოლოგია შესაძლებლად რჩება. რისკ-ფაქტორებისა და მკერდში პერიოდული მოჭერის გამო, სანამ ტკივილი კუჭს მიეწერება, მწვავე კორონარული სინდრომი ეკგ-ით და ტროპონინით უნდა გამოირიცხოს.","safety":{"level":"urgent","requires_escalation":false,"items":[{"title":"მწვავე კორონარული სინდრომი გამორიცხული არ არის","why":"ეპიგასტრული ტკივილი და მკერდში მოჭერა 58 წლის მწეველ მამაკაცში, არაკონტროლირებადი ჰიპერტენზიით.","action":"12-განხრიანი ეკგ ვიზიტის დასაწყისში; ტროპონინი, თუ ეკგ ან ანამნეზი საეჭვოა."},{"title":"პეპტიური წყლულის გართულების რისკი","why":"იბუპროფენის ყოველდღიური მიღება და ღამის, მზარდი ტკივილი.","action":"დააზუსტეთ შავი განავალი, სისხლიანი ღებინება და თავბრუსხვევა; შეაფასეთ პულსი და არტერიული წნევა."}]},"clinical_picture":{"timeline":[{"when":"2 კვირის წინ","what":"იბუპროფენის თითქმის ყოველდღიური მიღება მუხლის ტკივილის გამო","source_ids":["a9"]},{"when":"3 დღის წინ","what":"ტკივილი დაიწყო საღამოს, ვახშმის შემდეგ","source_ids":["a1"]},{"when":"ბოლო 3 დღე","what":"მუდმივი, მზარდი ტკივილი; ღამით ძლიერდება და აღვიძებს","source_ids":["a2","chief"]}],"key_positives":[{"text":"მუდმივი, მზარდი ტკივილი, ღამით ძლიერდება","source_ids":["a2"]},{"text":"ირადიაცია მარჯვენა ნეკნქვეშა არეში","source_ids":["a3"]},{"text":"გულისრევა","source_ids":["a4"]},{"text":"იბუპროფენი ყოველდღიურად 2 კვირა","source_ids":["a9"]},{"text":"მკერდში პერიოდული მოჭერა","source_ids":["a5"]},{"text":"მოწევა და არარეგულარულად ნამკურნალები ჰიპერტენზია","source_ids":["a10"]}],"key_negatives":[{"text":"ღებინება არ აქვს","source_ids":["a4"]},{"text":"ცხელება არ ჰქონია","source_ids":["a7"]},{"text":"შავი ან მუქი განავალი არ აღუნიშნავს","source_ids":["a8"]}],"unknowns":[{"text":"ტკივილის კავშირი ფიზიკურ დატვირთვასთან","why_it_matters":"დატვირთვით პროვოცირებული ტკივილი კარდიულ წარმოშობაზე მიუთითებს."},{"text":"სიყვითლე და შარდის ფერი ობიექტურად","why_it_matters":"სიყვითლე ან მუქი შარდი ბილიარულ ობსტრუქციას აყენებს წინა პლანზე."},{"text":"სასიცოცხლო ნიშნები","why_it_matters":"ტაქიკარდია ან ჰიპოტენზია სისხლდენაზე ან სეფსისზე მიუთითებს."},{"text":"ალკოჰოლის მოხმარება","why_it_matters":"ცვლის პანკრეატიტისა და გასტრიტის ალბათობას."}],"contradictions":[{"text":"ცხიმიანი საკვები ტკივილს აძლიერებს, მცირე ულუფა კი ამსუბუქებს — ბილიარული და თორმეტგოჯა ნაწლავის წყლულის სურათი ერთმანეთს ფარავს.","source_ids":["a6"]},{"text":"მკერდში მოჭერას პაციენტი კუჭს მიაწერს; ეს პაციენტის ინტერპრეტაციაა და დადასტურებული არ არის.","source_ids":["a5"]}]},"assessment":{"status":"LEADING_CLINICAL_CONSIDERATION","statement":"ყველაზე სავარაუდოა NSAID-ასოცირებული გასტრიტი ან პეპტიური წყლული, თუმცა ბილიარული კოლიკა ან ქოლეცისტიტი და მწვავე კორონარული სინდრომი ჯერ გამორიცხული არ არის.","leading":{"condition":"NSAID-ასოცირებული გასტრიტი / პეპტიური წყლული","why":"ყოველდღიური იბუპროფენი, ეპიგასტრული ლოკალიზაცია, ღამის ტკივილი და მცირე ულუფით შემსუბუქება.","supporting":[{"text":"იბუპროფენი ყოველდღიურად 2 კვირა","source_ids":["a9"]},{"text":"ღამით ძლიერდება და აღვიძებს","source_ids":["a2"]},{"text":"მცირე ულუფა ამსუბუქებს","source_ids":["a6"]}],"against":["ირადიაცია მარჯვნივ, ნეკნების ქვეშ","ცხიმიანი საკვების შემდეგ გაუარესება"],"missing":["ეპიგასტრული მგრძნობელობა გასინჯვისას","Helicobacter pylori სტატუსი","ჰემოგლობინი"]}},"differential":[{"condition":"პეპტიური წყლული (თორმეტგოჯა ნაწლავის ან კუჭის)","weight":"stronger","why":"NSAID-ის ყოველდღიური მიღება, ღამის ტკივილი და ჭამით შემსუბუქება.","supporting":[{"text":"იბუპროფენი 2 კვირა","source_ids":["a9"]},{"text":"ღამის ტკივილი","source_ids":["a2"]}],"against":["ტკივილის მუდმივი ხასიათი გართულებაზე ან სხვა მიზეზზე მიუთითებს"],"missing":["H. pylori","ჰემოგლობინი"]},{"condition":"NSAID-ასოცირებული ეროზიული გასტრიტი","weight":"possible","why":"იგივე ექსპოზიცია; ეპიგასტრული დისკომფორტი და გულისრევა.","supporting":[{"text":"გულისრევა","source_ids":["a4"]}],"against":[],"missing":["ენდოსკოპიური დადასტურება"]},{"condition":"ბილიარული კოლიკა / მწვავე ქოლეცისტიტი","weight":"possible","why":"ცხიმიანის შემდეგ გაუარესება, მარჯვენა ნეკნქვეშა ირადიაცია და გულისრევა.","supporting":[{"text":"ცხიმიანი საკვები აძლიერებს","source_ids":["a6"]},{"text":"მარჯვენა ნეკნქვეშა ირადიაცია","source_ids":["a3"]}],"against":["ცხელება არ აქვს","ტკივილი ძირითადად ეპიგასტრიუმშია"],"missing":["მერფის ნიშანი","მუცლის ღრუს ულტრაბგერა","ღვიძლის ფუნქციური სინჯები"]},{"condition":"მწვავე პანკრეატიტი","weight":"less_likely","why":"მუდმივი ეპიგასტრული ტკივილი გულისრევით.","supporting":[{"text":"მუდმივი ტკივილი","source_ids":["a2"]}],"against":["ზურგში ირადიაცია არ აღუწერია"],"missing":["ლიპაზა","ალკოჰოლის ანამნეზი"]}],"dangerous_alternatives":[{"condition":"მწვავე კორონარული სინდრომი (ქვედა კედლის იშემია)","why_it_matters":"ქვედა კედლის იშემია შეიძლება მხოლოდ ეპიგასტრული ტკივილით და გულისრევით გამოვლინდეს; გამოტოვება სიცოცხლისთვის საშიშია.","why_here":"58 წლის მამაკაცი, მწეველი, არაკონტროლირებადი ჰიპერტენზიით; მკერდში პერიოდული მოჭერა და ქოშინი კიბეზე.","supporting":[{"text":"მკერდში მოჭერა","source_ids":["a5"]},{"text":"მოწევა, ჰიპერტენზია","source_ids":["a10"]}],"unknown":["ტკივილის კავშირი დატვირთვასთან","ოფლიანობა","ოჯახური ანამნეზი"],"what_to_check":"12-განხრიანი ეკგ ვიზიტის პირველ წუთებში, სასიცოცხლო ნიშნები და ტკივილის ხასიათი დატვირთვისას.","investigation":"ეკგ და მაღალმგრძნობიარე ტროპონინი, საჭიროებისას განმეორებით"},{"condition":"სისხლმდენი ან პერფორირებული პეპტიური წყლული","why_it_matters":"სისხლდენა ან პერფორაცია სწრაფად იწვევს ჰემოდინამიკურ არასტაბილურობას ან პერიტონიტს.","why_here":"NSAID-ის ყოველდღიური მიღება და მზარდი ტკივილი.","supporting":[{"text":"იბუპროფენი 2 კვირა","source_ids":["a9"]}],"unknown":["მუცლის კედლის დაჭიმულობა","ჰემოგლობინი"],"what_to_check":"პერიტონეუმის გაღიზიანების ნიშნები, პულსი, არტერიული წნევა და ლორწოვანის ფერი.","investigation":"სისხლის საერთო ანალიზი; პერფორაციის ეჭვისას — მუცლის ღრუს კტ"}],"discriminators":[{"question":"ძლიერდება თუ არა ტკივილი ფიზიკური დატვირთვით და ქრება თუ არა მოსვენებისას?","separates":["მწვავე კორონარული სინდრომი","პეპტიური წყლული"],"why":"დატვირთვაზე დამოკიდებული ტკივილი კარდიულ წარმოშობას უჭერს მხარს."},{"question":"იწყება თუ არა ტკივილი ცხიმიანი საკვებიდან 30–60 წუთში და გრძელდება თუ არა რამდენიმე საათს?","separates":["ბილიარული კოლიკა","თორმეტგოჯა ნაწლავის წყლული"],"why":"ბილიარული ტკივილი ჭამიდან მალე იწყება; წყლულის ტკივილი ხშირად ჭამით მსუბუქდება."}],"action_plan":[{"step":1,"kind":"safety","title":"ეკგ ვიზიტის დასაწყისში","detail":"12-განხრიანი ეკგ გასინჯვამდე; სასიცოცხლო ნიშნები, მათ შორის სატურაცია.","why":"რისკ-ფაქტორების გამო კორონარული მიზეზის გამორიცხვა უპირველესია.","branches":[{"if":"ST სეგმენტის ცვლილება ან ახალი ბლოკადა","then":"შეწყვიტეთ ამბულატორიული შეფასება და გადაიყვანეთ გადაუდებელ კარდიოლოგიურ დახმარებაზე."},{"if":"ეკგ ნორმაა, ანამნეზი საეჭვოა","then":"მაღალმგრძნობიარე ტროპონინი, განმეორებით 1–3 საათში."}]},{"step":2,"kind":"history","title":"დააზუსტეთ დატვირთვასთან კავშირი და სისხლდენის ნიშნები","detail":"ჰკითხეთ დატვირთვით პროვოცირების, ოფლიანობის, სისხლიანი ღებინების, შავი განავლის, თავბრუსხვევისა და ალკოჰოლის შესახებ.","why":"ეს პასუხები ყველაზე მეტად ცვლის დიფერენციალს და სასწრაფოობას.","branches":[{"if":"ტკივილი დატვირთვით ძლიერდება","then":"მართეთ როგორც შესაძლო მწვავე კორონარული სინდრომი."},{"if":"შავი განავალი ან სისხლიანი ღებინება","then":"გადაუდებელი ჰოსპიტალიზაცია ენდოსკოპიისთვის."}]},{"step":3,"kind":"exam","title":"მუცლის გასინჯვა","detail":"ეპიგასტრული მგრძნობელობა, მერფის ნიშანი, პერიტონეუმის გაღიზიანება, სიყვითლე.","why":"განასხვავებს პეპტიურ, ბილიარულ და ქირურგიულ მიზეზებს.","branches":[{"if":"დადებითი მერფის ნიშანი","then":"მუცლის ღრუს ულტრაბგერა იმავე დღეს."},{"if":"მუცლის კედლის დაჭიმულობა","then":"პერფორაციის ეჭვი — გადაუდებელი ქირურგიული შეფასება."}]},{"step":4,"kind":"investigation","title":"ლაბორატორიული კვლევები","detail":"სისხლის საერთო ანალიზი, ლიპაზა, ღვიძლის ფუნქციური სინჯები, H. pylori.","why":"ადასტურებს ან გამორიცხავს სისხლდენას, პანკრეატიტს და ბილიარულ პათოლოგიას.","branches":[]},{"step":5,"kind":"decision","title":"NSAID-ის შეწყვეტა და მართვის გეგმა","detail":"იბუპროფენის შეწყვეტა; მკურნალობა შედეგების მიხედვით.","why":"NSAID წყლულისა და სისხლდენის რისკს ზრდის.","branches":[]},{"step":6,"kind":"monitor","title":"განმეორებითი კონტაქტი 24–48 საათში","detail":"ტკივილის დინამიკა, ახალი სიმპტომები და კვლევების შედეგები.","why":"მზარდი ტკივილი საჭიროებს მჭიდრო დაკვირვებას.","branches":[{"if":"ტკივილი მატულობს ან ჩნდება ცხელება","then":"იმავე დღის განმეორებითი შეფასება."}]}],"investigations":[{"name":"12-განხრიანი ეკგ","clinical_question":"არის თუ არა მიოკარდიუმის იშემიის ნიშნები?","why":"ეპიგასტრული ტკივილი შეიძლება ქვედა კედლის იშემიის გამოვლინება იყოს.","evaluates":"ST სეგმენტი, T კბილი, რიტმი და გამტარებლობა","result_status":"not_available","if_positive":"გადაუდებელი კარდიოლოგიური გზა.","if_negative":"ერთი ნორმალური ეკგ მწვავე კორონარულ სინდრომს არ გამორიცხავს; შეაფასეთ ტროპონინი.","branch":"სამოქმედო გეგმის ნაბიჯი 1"},{"name":"მაღალმგრძნობიარე ტროპონინი","clinical_question":"არის თუ არა მიოკარდიუმის დაზიანება?","why":"ეკგ-ის ცვლილების გარეშეც შესაძლებელია მიოკარდიუმის ინფარქტი.","evaluates":"მიოკარდიუმის დაზიანების ბიომარკერი","result_status":"not_available","if_positive":"მწვავე კორონარული სინდრომის მართვა.","if_negative":"განმეორებითი გაზომვა 1–3 საათში, თუ ტკივილი 3 საათზე ნაკლებ ხანს გრძელდება.","branch":"ნაბიჯი 1, მეორე განშტოება"},{"name":"სისხლის საერთო ანალიზი","clinical_question":"არის თუ არა ანემია ან ანთების ნიშნები?","why":"NSAID-ის ფონზე ფარული სისხლდენის რისკი.","evaluates":"ჰემოგლობინი, ლეიკოციტები, თრომბოციტები","result_status":"not_available","if_positive":"ანემია — ენდოსკოპიის დაჩქარება; ლეიკოციტოზი — ქოლეცისტიტის ეჭვი.","if_negative":"სისხლდენის ალბათობა მცირდება, თუმცა არ გამოირიცხება.","branch":"ნაბიჯი 4"},{"name":"მუცლის ღრუს ულტრაბგერა","clinical_question":"არის თუ არა ნაღვლის ბუშტის კენჭი ან ანთება?","why":"ცხიმიანი საკვებით გაუარესება და მარჯვენა ნეკნქვეშა ირადიაცია.","evaluates":"ნაღვლის ბუშტის კედელი, კენჭები, სანაღვლე გზები","result_status":"not_available","if_positive":"ქირურგის კონსულტაცია.","if_negative":"ბილიარული მიზეზი ნაკლებად სავარაუდოა; ყურადღება პეპტიურ მიზეზზე.","branch":"ნაბიჯი 3"},{"name":"Helicobacter pylori (სუნთქვის ტესტი ან განავლის ანტიგენი)","clinical_question":"არის თუ არა H. pylori ინფექცია?","why":"განსაზღვრავს წყლულის ეტიოლოგიას და მკურნალობას.","evaluates":"აქტიური ინფექცია","result_status":"not_available","if_positive":"ერადიკაციული თერაპია.","if_negative":"ძირითადი მიზეზი სავარაუდოდ NSAID-ია.","branch":"ნაბიჯი 5"}],"decision_changes":[{"finding":"ტკივილი დატვირთვით ძლიერდება","differential_effect":"მწვავე კორონარული სინდრომი წინა პლანზე","urgency_effect":"იზრდება — გადაუდებელი","next_action":"ეკგ და ტროპონინი დაუყოვნებლივ"},{"finding":"შავი განავალი ან ჰემოგლობინის დაქვეითება","differential_effect":"სისხლმდენი პეპტიური წყლული","urgency_effect":"გადაუდებელი","next_action":"ჰოსპიტალიზაცია და ენდოსკოპია"},{"finding":"დადებითი მერფის ნიშანი ან ცხელება","differential_effect":"მწვავე ქოლეცისტიტი წინა პლანზე","urgency_effect":"იმავე დღის შეფასება","next_action":"ულტრაბგერა და ქირურგის კონსულტაცია"},{"finding":"ლიპაზა მომატებულია","differential_effect":"მწვავე პანკრეატიტი","urgency_effect":"ჰოსპიტალიზაციის განხილვა","next_action":"სითხეები; საჭიროებისას კტ"}],"exam_priorities":[{"exam":"სასიცოცხლო ნიშნები, მათ შორის სატურაცია","why":"ჰემოდინამიკური არასტაბილურობის ადრეული ნიშნები."},{"exam":"მუცლის პალპაცია და მერფის ნიშანი","why":"პეპტიური და ბილიარული მიზეზების განსხვავება."},{"exam":"კანი და სკლერა","why":"სიყვითლე ან სიფერმკრთალე."}],"records_to_review":[{"record":"წინა ეკგ, თუ არსებობს","why":"ახალი ცვლილებების შედარებისთვის."},{"record":"ანტიჰიპერტენზიული მკურნალობის ისტორია","why":"წნევის კონტროლისა და რისკის შესაფასებლად."}],"monitoring":[{"what":"ტკივილის დინამიკა და ახალი სიმპტომები 24–48 საათში","why":"მზარდი ტკივილი გართულებაზე შეიძლება მიუთითებდეს."}],"specialist":[{"specialty":"კარდიოლოგი","why":"ეკგ-ის ან ტროპონინის ცვლილების შემთხვევაში."},{"specialty":"გასტროენტეროლოგი","why":"ენდოსკოპია, თუ არის სისხლდენის ნიშნები ან სიმპტომები გრძელდება."}],"evidence":[{"title":"Dyspepsia and gastro-oesophageal reflux disease in adults","source":"NICE CG184","url":"https://www.nice.org.uk/guidance/cg184","supports":"NSAID-ის შეწყვეტა და H. pylori-ის ტესტირება დისპეფსიისას."},{"title":"Recent-onset chest pain of suspected cardiac origin","source":"NICE CG95","url":"https://www.nice.org.uk/guidance/cg95","supports":"ეკგ და ტროპონინი ატიპური პრეზენტაციისას."}],"verification":["მკერდში მოჭერის ხასიათი და დატვირთვასთან კავშირი პირისპირ უნდა დაზუსტდეს.","მედიკამენტების სრული სია, მათ შორის ასპირინი და ანტიკოაგულანტები."],"disagreements":[{"topic":"ბილიარული თუ პეპტიური","detail":"საკვებთან კავშირი ორივე მიმართულებით მიუთითებს; გადაწყვეტს გასინჯვა და ულტრაბგერა."}],"limitations":["ფიზიკური გასინჯვა და სასიცოცხლო ნიშნები ხელმისაწვდომი არ არის.","ინფორმაცია ეფუძნება მხოლოდ პაციენტის თვითაღწერას."]},"decision":null},"cases":{"cases":[{"case_id":"MI-2026-0412","created_at":"2026-10-03T09:44:00Z","submitted_at":"2026-10-03T09:52:00Z","updated_at":"2026-10-03T09:52:00Z","language":"ka","status":"escalated","workflow":"new","patient":{"name":"თამარ ჯაფარიძე","personal_id":"00000000003","age":64,"sex":"female"},"complaint":"დილიდან მკერდში ძლიერი ტკივილი მაქვს, მარცხენა ხელში მიდის და ოფლი მასხამს","headline":"","safety_level":"emergency","requires_escalation":true,"question_count":4,"completion_reason":"SAFETY_ESCALATION","assessment_status":"URGENT_CLINICAL_REVIEW","leading_condition":"მწვავე კორონარული სინდრომი","review_status":"failed","decision_status":"none"},{"case_id":"MI-2026-0409","created_at":"2026-10-03T09:21:00Z","submitted_at":"2026-10-03T09:35:00Z","updated_at":"2026-10-03T09:35:00Z","language":"ka","status":"submitted","workflow":"new","patient":{"name":"გიორგი მაისურაძე","personal_id":"00000000004","age":58,"sex":"male"},"complaint":"მუცლის ზედა ნაწილში მტკივა, უკვე სამი დღეა და სულ უარესდება","headline":"3 დღის მუდმივი, მზარდი ეპიგასტრული ტკივილი NSAID-ის ფონზე; გამოსარიცხია მწვავე კორონარული სინდრომი","safety_level":"urgent","requires_escalation":false,"question_count":10,"completion_reason":"SUFFICIENT_INTAKE","assessment_status":"LEADING_CLINICAL_CONSIDERATION","leading_condition":"NSAID-ასოცირებული გასტრიტი / პეპტიური წყლული","review_status":"ready","decision_status":"none"},{"case_id":"MI-2026-0407","created_at":"2026-10-03T08:58:00Z","submitted_at":null,"updated_at":"2026-10-03T09:05:00Z","language":"ka","status":"in_progress","workflow":"new","patient":{"name":"დავით ღლონტი","personal_id":"00000000005","age":27,"sex":"male"},"complaint":"ყელი მტკივა და ყლაპვა მიჭირს","headline":"","safety_level":"routine","requires_escalation":false,"question_count":3,"completion_reason":"","assessment_status":"","leading_condition":"","review_status":"not_started","decision_status":"none"},{"case_id":"MI-2026-0402","created_at":"2026-10-03T07:40:00Z","submitted_at":"2026-10-03T07:51:00Z","updated_at":"2026-10-03T08:20:00Z","language":"ka","status":"submitted","workflow":"in_review","patient":{"name":"ლევან კაპანაძე","personal_id":"00000000001","age":31,"sex":"male"},"complaint":"ერთი კვირაა ხველა და სურდო მაქვს, ღამით ცოტა მიცხელებს","headline":"","safety_level":"routine","requires_escalation":false,"question_count":8,"completion_reason":"NO_HIGH_VALUE_QUESTIONS_REMAIN","assessment_status":"","leading_condition":"","review_status":"not_started","decision_status":"draft"},{"case_id":"MI-2026-0398","created_at":"2026-10-02T15:02:00Z","submitted_at":"2026-10-02T15:14:00Z","updated_at":"2026-10-02T16:30:00Z","language":"ka","status":"submitted","workflow":"reviewed","patient":{"name":"ეკა ნოზაძე","personal_id":"00000000002","age":42,"sex":"female"},"complaint":"საღამოობით თავი მტკივა ხოლმე, შუბლის და კეფის არეში, ორი კვირაა","headline":"ორკვირიანი საღამოს ორმხრივი თავის ტკივილი, საგანგაშო ნიშნების გარეშე","safety_level":"routine","requires_escalation":false,"question_count":9,"completion_reason":"INTERVIEW_LIMIT_REACHED","assessment_status":"LEADING_CLINICAL_CONSIDERATION","leading_condition":"დაძაბულობის ტიპის თავის ტკივილი","review_status":"ready","decision_status":"final"}]}}/*@END*/;

  const MAIN_REVIEW_EN = {
    version: 1,
    language: "en",
    generated_by: "model",
    generated_at: "2026-10-03T09:36:40Z",
    headline: "Three days of constant, worsening epigastric pain on daily NSAIDs; acute coronary syndrome must be excluded",
    executive_summary:
      "58-year-old male smoker with hypertension reports three days of constant epigastric pain, worse at night and at times radiating under the right ribs, with nausea but no vomiting. He has taken ibuprofen almost daily for two weeks. NSAID-associated gastritis or peptic ulcer is the leading consideration; biliary disease remains possible. Given his risk factors and intermittent chest tightness, acute coronary syndrome should be excluded with an ECG and troponin before the pain is attributed to the stomach.",
    safety: {
      level: "urgent",
      requires_escalation: false,
      items: [
        {
          title: "Acute coronary syndrome not excluded",
          why: "Epigastric pain and chest tightness in a 58-year-old smoker with poorly controlled hypertension.",
          action: "12-lead ECG at the start of the visit; troponin if the ECG or history is concerning.",
        },
        {
          title: "Risk of a complicated peptic ulcer",
          why: "Daily ibuprofen and worsening night pain.",
          action: "Ask about black stools, haematemesis and dizziness; check pulse and blood pressure.",
        },
      ],
    },
    clinical_picture: {
      timeline: [
        { when: "2 weeks ago", what: "Near-daily ibuprofen for knee pain", source_ids: ["a9"] },
        { when: "3 days ago", what: "Pain began in the evening after dinner", source_ids: ["a1"] },
        { when: "Last 3 days", what: "Constant, worsening pain; worse at night and wakes him", source_ids: ["a2", "chief"] },
      ],
      key_positives: [
        { text: "Constant, worsening pain, worse at night", source_ids: ["a2"] },
        { text: "Radiation under the right ribs", source_ids: ["a3"] },
        { text: "Nausea", source_ids: ["a4"] },
        { text: "Daily ibuprofen for 2 weeks", source_ids: ["a9"] },
        { text: "Intermittent chest tightness", source_ids: ["a5"] },
        { text: "Smoker; hypertension treated irregularly", source_ids: ["a10"] },
      ],
      key_negatives: [
        { text: "No vomiting", source_ids: ["a4"] },
        { text: "No fever", source_ids: ["a7"] },
        { text: "No black or tarry stools", source_ids: ["a8"] },
      ],
      unknowns: [
        { text: "Relation of pain to exertion", why_it_matters: "Exertional pain points to a cardiac cause." },
        { text: "Objective jaundice and urine colour", why_it_matters: "Jaundice or dark urine moves biliary obstruction forward." },
        { text: "Vital signs", why_it_matters: "Tachycardia or hypotension suggests bleeding or sepsis." },
        { text: "Alcohol use", why_it_matters: "Changes the likelihood of pancreatitis and gastritis." },
      ],
      contradictions: [
        { text: "Fatty food worsens the pain while small meals ease it — biliary and duodenal ulcer patterns overlap.", source_ids: ["a6"] },
        { text: "The patient attributes chest tightness to his stomach; this is his interpretation and is not confirmed.", source_ids: ["a5"] },
      ],
    },
    assessment: {
      status: "LEADING_CLINICAL_CONSIDERATION",
      statement:
        "NSAID-associated gastritis or peptic ulcer is most likely, but biliary colic or cholecystitis and acute coronary syndrome are not yet excluded.",
      leading: {
        condition: "NSAID-associated gastritis / peptic ulcer",
        why: "Daily ibuprofen, epigastric location, night pain and relief with small meals.",
        supporting: [
          { text: "Daily ibuprofen for 2 weeks", source_ids: ["a9"] },
          { text: "Worse at night, wakes him", source_ids: ["a2"] },
          { text: "Small meals ease it", source_ids: ["a6"] },
        ],
        against: ["Radiation under the right ribs", "Worse after fatty food"],
        missing: ["Epigastric tenderness on examination", "Helicobacter pylori status", "Haemoglobin"],
      },
    },
    differential: [
      {
        condition: "Peptic ulcer (duodenal or gastric)",
        weight: "stronger",
        why: "Daily NSAID use, night pain and relief with food.",
        supporting: [
          { text: "Ibuprofen for 2 weeks", source_ids: ["a9"] },
          { text: "Night pain", source_ids: ["a2"] },
        ],
        against: ["Constant pain suggests a complication or another cause"],
        missing: ["H. pylori", "Haemoglobin"],
      },
      {
        condition: "NSAID-associated erosive gastritis",
        weight: "possible",
        why: "Same exposure; epigastric discomfort with nausea.",
        supporting: [{ text: "Nausea", source_ids: ["a4"] }],
        against: [],
        missing: ["Endoscopic confirmation"],
      },
      {
        condition: "Biliary colic / acute cholecystitis",
        weight: "possible",
        why: "Worse after fatty food, right subcostal radiation and nausea.",
        supporting: [
          { text: "Fatty food worsens it", source_ids: ["a6"] },
          { text: "Right subcostal radiation", source_ids: ["a3"] },
        ],
        against: ["No fever", "Pain is mainly epigastric"],
        missing: ["Murphy's sign", "Abdominal ultrasound", "Liver function tests"],
      },
      {
        condition: "Acute pancreatitis",
        weight: "less_likely",
        why: "Constant epigastric pain with nausea.",
        supporting: [{ text: "Constant pain", source_ids: ["a2"] }],
        against: ["No back radiation described"],
        missing: ["Lipase", "Alcohol history"],
      },
    ],
    dangerous_alternatives: [
      {
        condition: "Acute coronary syndrome (inferior ischaemia)",
        why_it_matters: "Inferior ischaemia can present with epigastric pain and nausea alone; missing it is life-threatening.",
        why_here: "58-year-old male smoker with poorly controlled hypertension; intermittent chest tightness and breathlessness on stairs.",
        supporting: [
          { text: "Chest tightness", source_ids: ["a5"] },
          { text: "Smoking, hypertension", source_ids: ["a10"] },
        ],
        unknown: ["Relation to exertion", "Sweating", "Family history"],
        what_to_check: "12-lead ECG in the first minutes of the visit, vital signs, and how the pain behaves with exertion.",
        investigation: "ECG and high-sensitivity troponin, repeated if needed",
      },
      {
        condition: "Bleeding or perforated peptic ulcer",
        why_it_matters: "Bleeding or perforation quickly leads to haemodynamic instability or peritonitis.",
        why_here: "Daily NSAID use and worsening pain.",
        supporting: [{ text: "Ibuprofen for 2 weeks", source_ids: ["a9"] }],
        unknown: ["Abdominal guarding", "Haemoglobin"],
        what_to_check: "Signs of peritonism, pulse, blood pressure and mucosal colour.",
        investigation: "Full blood count; abdominal CT if perforation is suspected",
      },
    ],
    discriminators: [
      {
        question: "Does the pain get worse with exertion and settle with rest?",
        separates: ["Acute coronary syndrome", "Peptic ulcer"],
        why: "Exertion-dependent pain supports a cardiac origin.",
      },
      {
        question: "Does the pain start 30–60 minutes after fatty food and last several hours?",
        separates: ["Biliary colic", "Duodenal ulcer"],
        why: "Biliary pain starts soon after eating; ulcer pain is often eased by food.",
      },
    ],
    action_plan: [
      {
        step: 1,
        kind: "safety",
        title: "ECG at the start of the visit",
        detail: "12-lead ECG before the examination; vital signs including oxygen saturation.",
        why: "Given the risk factors, excluding a coronary cause comes first.",
        branches: [
          { if: "ST changes or a new bundle branch block", then: "Stop the outpatient assessment and transfer to emergency cardiac care." },
          { if: "Normal ECG but a concerning history", then: "High-sensitivity troponin, repeated at 1–3 hours." },
        ],
      },
      {
        step: 2,
        kind: "history",
        title: "Clarify exertional pattern and bleeding signs",
        detail: "Ask about exertional triggers, sweating, haematemesis, black stools, dizziness and alcohol.",
        why: "These answers change the differential and urgency the most.",
        branches: [
          { if: "Pain worsens with exertion", then: "Manage as possible acute coronary syndrome." },
          { if: "Black stools or haematemesis", then: "Emergency admission for endoscopy." },
        ],
      },
      {
        step: 3,
        kind: "exam",
        title: "Abdominal examination",
        detail: "Epigastric tenderness, Murphy's sign, peritonism, jaundice.",
        why: "Separates peptic, biliary and surgical causes.",
        branches: [
          { if: "Positive Murphy's sign", then: "Same-day abdominal ultrasound." },
          { if: "Guarding or rigidity", then: "Suspected perforation — urgent surgical review." },
        ],
      },
      {
        step: 4,
        kind: "investigation",
        title: "Laboratory tests",
        detail: "Full blood count, lipase, liver function tests, H. pylori.",
        why: "Confirms or excludes bleeding, pancreatitis and biliary disease.",
        branches: [],
      },
      {
        step: 5,
        kind: "decision",
        title: "Stop the NSAID and set the management plan",
        detail: "Stop ibuprofen; choose treatment based on results.",
        why: "NSAIDs increase ulcer and bleeding risk.",
        branches: [],
      },
      {
        step: 6,
        kind: "monitor",
        title: "Follow-up contact in 24–48 hours",
        detail: "Pain trend, new symptoms and test results.",
        why: "Worsening pain needs close follow-up.",
        branches: [{ if: "Pain increases or fever appears", then: "Same-day reassessment." }],
      },
    ],
    investigations: [
      {
        name: "12-lead ECG",
        clinical_question: "Are there signs of myocardial ischaemia?",
        why: "Epigastric pain can be the presentation of inferior ischaemia.",
        evaluates: "ST segment, T waves, rhythm and conduction",
        result_status: "not_available",
        if_positive: "Emergency cardiac pathway.",
        if_negative: "A single normal ECG does not exclude acute coronary syndrome; assess troponin.",
        branch: "Action plan step 1",
      },
      {
        name: "High-sensitivity troponin",
        clinical_question: "Is there myocardial injury?",
        why: "Myocardial infarction is possible without ECG changes.",
        evaluates: "Biomarker of myocardial injury",
        result_status: "not_available",
        if_positive: "Manage as acute coronary syndrome.",
        if_negative: "Repeat at 1–3 hours if pain began less than 3 hours earlier.",
        branch: "Step 1, second branch",
      },
      {
        name: "Full blood count",
        clinical_question: "Is there anaemia or inflammation?",
        why: "Risk of occult bleeding on NSAIDs.",
        evaluates: "Haemoglobin, white cells, platelets",
        result_status: "not_available",
        if_positive: "Anaemia — expedite endoscopy; leucocytosis — suspect cholecystitis.",
        if_negative: "Bleeding is less likely but not excluded.",
        branch: "Step 4",
      },
      {
        name: "Abdominal ultrasound",
        clinical_question: "Are there gallstones or gallbladder inflammation?",
        why: "Worse with fatty food and right subcostal radiation.",
        evaluates: "Gallbladder wall, stones, bile ducts",
        result_status: "not_available",
        if_positive: "Surgical consultation.",
        if_negative: "Biliary cause less likely; focus on a peptic cause.",
        branch: "Step 3",
      },
      {
        name: "Helicobacter pylori (breath test or stool antigen)",
        clinical_question: "Is there H. pylori infection?",
        why: "Determines ulcer aetiology and treatment.",
        evaluates: "Active infection",
        result_status: "not_available",
        if_positive: "Eradication therapy.",
        if_negative: "The NSAID is the likely main cause.",
        branch: "Step 5",
      },
    ],
    decision_changes: [
      { finding: "Pain worsens with exertion", differential_effect: "Acute coronary syndrome moves to the front", urgency_effect: "Rises — emergency", next_action: "ECG and troponin immediately" },
      { finding: "Black stools or falling haemoglobin", differential_effect: "Bleeding peptic ulcer", urgency_effect: "Emergency", next_action: "Admission and endoscopy" },
      { finding: "Positive Murphy's sign or fever", differential_effect: "Acute cholecystitis moves to the front", urgency_effect: "Same-day assessment", next_action: "Ultrasound and surgical review" },
      { finding: "Raised lipase", differential_effect: "Acute pancreatitis", urgency_effect: "Consider admission", next_action: "Fluids; CT if needed" },
    ],
    exam_priorities: [
      { exam: "Vital signs including oxygen saturation", why: "Early signs of haemodynamic instability." },
      { exam: "Abdominal palpation and Murphy's sign", why: "Separates peptic from biliary causes." },
      { exam: "Skin and sclera", why: "Jaundice or pallor." },
    ],
    records_to_review: [
      { record: "Any previous ECG", why: "To compare for new changes." },
      { record: "Antihypertensive treatment history", why: "To judge blood pressure control and risk." },
    ],
    monitoring: [{ what: "Pain trend and new symptoms over 24–48 hours", why: "Worsening pain may signal a complication." }],
    specialist: [
      { specialty: "Cardiology", why: "If the ECG or troponin is abnormal." },
      { specialty: "Gastroenterology", why: "Endoscopy if there are bleeding signs or symptoms persist." },
    ],
    evidence: [
      {
        title: "Dyspepsia and gastro-oesophageal reflux disease in adults",
        source: "NICE CG184",
        url: "https://www.nice.org.uk/guidance/cg184",
        supports: "Stopping the NSAID and testing for H. pylori in dyspepsia.",
      },
      {
        title: "Recent-onset chest pain of suspected cardiac origin",
        source: "NICE CG95",
        url: "https://www.nice.org.uk/guidance/cg95",
        supports: "ECG and troponin in atypical presentations.",
      },
    ],
    verification: [
      "Confirm the character of the chest tightness and its relation to exertion in person.",
      "Full medication list, including aspirin and anticoagulants.",
    ],
    disagreements: [{ topic: "Biliary or peptic", detail: "The food pattern points both ways; examination and ultrasound will decide." }],
    limitations: ["No physical examination or vital signs are available.", "Information is based only on the patient's self-report."],
  };

  const CHEST_ANSWERS = [
    { id: "c1", n: 1, question: "როდის დაიწყო ტკივილი?", answer: "დილით, დაახლოებით ორი საათის წინ, მოსვენებულ მდგომარეობაში.", note: "", topic: "დაწყება" },
    { id: "c2", n: 2, question: "როგორი ხასიათისაა ტკივილი?", answer: "მაწვება, თითქოს მძიმე რამე მადევს მკერდზე.", note: "", topic: "ხასიათი" },
    { id: "c3", n: 3, question: "სადმე გადადის ტკივილი?", answer: "მარცხენა ხელში და ყბაში.", note: "", topic: "ირადიაცია" },
    { id: "c4", n: 4, question: "გაქვთ ოფლიანობა, ქოშინი ან გულისრევა?", answer: "ოფლი მასხამს და ცოტა მიჭირს სუნთქვა.", note: "", topic: "თანმხლები სიმპტომები" },
  ];

  const CHEST_REVIEW_KA = {
    version: 1,
    language: "ka",
    generated_by: "deterministic",
    generated_at: "2026-10-03T09:53:00Z",
    headline: "მოსვენებისას დაწყებული მკერდის მჭიდროვანი ტკივილი ირადიაციით მარცხენა ხელსა და ყბაში, ოფლიანობით",
    executive_summary:
      "64 წლის ქალი, ორი საათია მოსვენებისას დაწყებული მჭიდროვანი მკერდის ტკივილით, ირადიაციით მარცხენა ხელსა და ყბაში, ოფლიანობითა და ქოშინით. სურათი შეესაბამება მწვავე კორონარულ სინდრომს და საჭიროებს დაუყოვნებლივ გადაუდებელ დახმარებას.",
    safety: {
      level: "emergency",
      requires_escalation: true,
      items: [
        {
          title: "სავარაუდო მწვავე კორონარული სინდრომი",
          why: "მოსვენებისას მჭიდროვანი ტკივილი, ტიპური ირადიაცია და ოფლიანობა.",
          action: "დაუყოვნებლივ გამოიძახეთ სასწრაფო დახმარება (112); ნუ დაელოდებით ვიზიტს.",
        },
      ],
    },
    clinical_picture: {
      timeline: [{ when: "2 საათის წინ", what: "მოსვენებისას დაწყებული მკერდის ტკივილი", source_ids: ["c1"] }],
      key_positives: [
        { text: "მჭიდროვანი, მძიმე ხასიათი", source_ids: ["c2"] },
        { text: "ირადიაცია მარცხენა ხელსა და ყბაში", source_ids: ["c3"] },
        { text: "ოფლიანობა და ქოშინი", source_ids: ["c4"] },
      ],
      key_negatives: [],
      unknowns: [{ text: "წინა კარდიოლოგიური ანამნეზი", why_it_matters: "არ ცვლის გადაუდებელ ტაქტიკას." }],
      contradictions: [],
    },
    assessment: {
      status: "URGENT_CLINICAL_REVIEW",
      statement: "სიმპტომები ტიპურია მწვავე კორონარული სინდრომისთვის; ინტერვიუ შეწყდა უსაფრთხოების მიზნით.",
      leading: {
        condition: "მწვავე კორონარული სინდრომი",
        why: "მოსვენებისას დაწყებული მჭიდროვანი ტკივილი ტიპური ირადიაციით და ვეგეტატიური ნიშნებით.",
        supporting: [
          { text: "ირადიაცია ხელსა და ყბაში", source_ids: ["c3"] },
          { text: "ოფლიანობა", source_ids: ["c4"] },
        ],
        against: [],
        missing: ["ეკგ", "ტროპონინი"],
      },
    },
    differential: [],
    dangerous_alternatives: [
      {
        condition: "აორტის განშრევება",
        why_it_matters: "ანტიკოაგულაცია ან თრომბოლიზისი შეიძლება ფატალური იყოს.",
        why_here: "მწვავე, ძლიერი მკერდის ტკივილი ასაკოვან პაციენტში.",
        supporting: [{ text: "მწვავე დაწყება", source_ids: ["c1"] }],
        unknown: ["ტკივილის ზურგში გადაცემა", "წნევის სხვაობა ხელებზე"],
        what_to_check: "წნევა ორივე ხელზე და ტკივილის ხასიათი (გლეჯითი, ზურგში).",
        investigation: "კტ-ანგიოგრაფია საავადმყოფოში",
      },
    ],
    discriminators: [],
    action_plan: [
      {
        step: 1,
        kind: "safety",
        title: "დაუყოვნებლივ გამოიძახეთ სასწრაფო დახმარება",
        detail: "112; პაციენტი არ უნდა დარჩეს მარტო და არ უნდა იმოძრაოს.",
        why: "დროული რეპერფუზია ამცირებს მიოკარდიუმის დაზიანებას.",
        branches: [],
      },
    ],
    investigations: [],
    decision_changes: [],
    exam_priorities: [],
    records_to_review: [],
    monitoring: [],
    specialist: [],
    evidence: [],
    verification: [],
    disagreements: [],
    limitations: ["ინტერვიუ შეწყდა 4 კითხვის შემდეგ უსაფრთხოების მიზნით."],
  };

  const CHEST_REVIEW_EN = {
    version: 1,
    language: "en",
    generated_by: "deterministic",
    generated_at: "2026-10-03T09:53:00Z",
    headline: "Crushing chest pain at rest radiating to the left arm and jaw, with sweating",
    executive_summary:
      "64-year-old woman with two hours of crushing chest pain that began at rest, radiating to the left arm and jaw, with sweating and breathlessness. The picture fits acute coronary syndrome and needs emergency care now.",
    safety: {
      level: "emergency",
      requires_escalation: true,
      items: [
        {
          title: "Probable acute coronary syndrome",
          why: "Crushing pain at rest with typical radiation and sweating.",
          action: "Call emergency services (112) now; do not wait for the visit.",
        },
      ],
    },
    clinical_picture: {
      timeline: [{ when: "2 hours ago", what: "Chest pain began at rest", source_ids: ["c1"] }],
      key_positives: [
        { text: "Crushing, heavy character", source_ids: ["c2"] },
        { text: "Radiation to the left arm and jaw", source_ids: ["c3"] },
        { text: "Sweating and breathlessness", source_ids: ["c4"] },
      ],
      key_negatives: [],
      unknowns: [{ text: "Previous cardiac history", why_it_matters: "Does not change the emergency plan." }],
      contradictions: [],
    },
    assessment: {
      status: "URGENT_CLINICAL_REVIEW",
      statement: "Symptoms are typical of acute coronary syndrome; the interview stopped for safety.",
      leading: {
        condition: "Acute coronary syndrome",
        why: "Crushing pain at rest with typical radiation and autonomic signs.",
        supporting: [
          { text: "Radiation to arm and jaw", source_ids: ["c3"] },
          { text: "Sweating", source_ids: ["c4"] },
        ],
        against: [],
        missing: ["ECG", "Troponin"],
      },
    },
    differential: [],
    dangerous_alternatives: [
      {
        condition: "Aortic dissection",
        why_it_matters: "Anticoagulation or thrombolysis could be fatal.",
        why_here: "Sudden severe chest pain in an older patient.",
        supporting: [{ text: "Sudden onset", source_ids: ["c1"] }],
        unknown: ["Radiation to the back", "Arm-to-arm blood pressure difference"],
        what_to_check: "Blood pressure in both arms and the pain character (tearing, to the back).",
        investigation: "CT angiography in hospital",
      },
    ],
    discriminators: [],
    action_plan: [
      {
        step: 1,
        kind: "safety",
        title: "Call emergency services now",
        detail: "112; the patient should not be left alone or exert themselves.",
        why: "Timely reperfusion limits myocardial damage.",
        branches: [],
      },
    ],
    investigations: [],
    decision_changes: [],
    exam_priorities: [],
    records_to_review: [],
    monitoring: [],
    specialist: [],
    evidence: [],
    verification: [],
    disagreements: [],
    limitations: ["The interview stopped after 4 questions for safety."],
  };

  const HEAD_ANSWERS = [
    { id: "h1", n: 1, question: "როდის დაიწყო თავის ტკივილი?", answer: "დაახლოებით ორი კვირის წინ, ძირითადად საღამოობით.", note: "", topic: "დაწყება" },
    { id: "h2", n: 2, question: "როგორი ხასიათისაა?", answer: "თითქოს სალტე მაქვს შემოჭერილი, არ ფეთქავს.", note: "", topic: "ხასიათი" },
    { id: "h3", n: 3, question: "გაქვთ გულისრევა, სინათლის აუტანლობა ან მხედველობის დარღვევა?", answer: "არა.", note: "", topic: "თანმხლები სიმპტომები" },
    { id: "h4", n: 4, question: "ბოლო დროს სტრესი ან ძილის ნაკლებობა ხომ არ გაქვთ?", answer: "სამსახურში ბევრს ვმუშაობ კომპიუტერთან, ცოტას ვძინავ.", note: "", topic: "ტრიგერები" },
  ];

  const HEAD_REVIEW_KA = {
    version: 1,
    language: "ka",
    generated_by: "model",
    generated_at: "2026-10-02T15:15:00Z",
    headline: "ორკვირიანი საღამოს ორმხრივი თავის ტკივილი, საგანგაშო ნიშნების გარეშე",
    executive_summary:
      "42 წლის ქალი, ორი კვირაა საღამოობით აღენიშნება ორმხრივი, მჭიდროვანი, არაპულსირებადი თავის ტკივილი თანმხლები სიმპტომების გარეშე, სტრესისა და ძილის ნაკლებობის ფონზე. ყველაზე სავარაუდოა დაძაბულობის ტიპის თავის ტკივილი.",
    safety: { level: "routine", requires_escalation: false, items: [] },
    clinical_picture: {
      timeline: [{ when: "2 კვირის წინ", what: "საღამოს თავის ტკივილის დაწყება", source_ids: ["h1"] }],
      key_positives: [
        { text: "სალტისებრი, არაპულსირებადი ტკივილი", source_ids: ["h2"] },
        { text: "სტრესი და ძილის ნაკლებობა", source_ids: ["h4"] },
      ],
      key_negatives: [{ text: "გულისრევა, ფოტოფობია და მხედველობის დარღვევა არ აქვს", source_ids: ["h3"] }],
      unknowns: [],
      contradictions: [],
    },
    assessment: {
      status: "LEADING_CLINICAL_CONSIDERATION",
      statement: "დაძაბულობის ტიპის თავის ტკივილი ყველაზე სავარაუდოა; საგანგაშო ნიშნები არ ვლინდება.",
      leading: {
        condition: "დაძაბულობის ტიპის თავის ტკივილი",
        why: "ორმხრივი სალტისებრი ტკივილი, ტრიგერები და თანმხლები სიმპტომების არარსებობა.",
        supporting: [{ text: "სალტისებრი ხასიათი", source_ids: ["h2"] }],
        against: [],
        missing: ["არტერიული წნევა"],
      },
    },
    differential: [
      { condition: "დაძაბულობის ტიპის თავის ტკივილი", weight: "stronger", why: "ტიპური ხასიათი და ტრიგერები.", supporting: [], against: [], missing: [] },
      { condition: "შაკიკი აურის გარეშე", weight: "less_likely", why: "საღამოს ეპიზოდები.", supporting: [], against: ["არაპულსირებადი", "გულისრევა არ აქვს"], missing: [] },
    ],
    dangerous_alternatives: [],
    discriminators: [],
    action_plan: [
      { step: 1, kind: "exam", title: "არტერიული წნევა და ნევროლოგიური სკრინინგი", detail: "", why: "მეორადი მიზეზის გამოსარიცხად.", branches: [] },
      { step: 2, kind: "decision", title: "ძილის ჰიგიენა და ანალგეტიკის შეზღუდული გამოყენება", detail: "", why: "მედიკამენტით გამოწვეული თავის ტკივილის პრევენცია.", branches: [] },
    ],
    investigations: [],
    decision_changes: [],
    exam_priorities: [],
    records_to_review: [],
    monitoring: [],
    specialist: [],
    evidence: [],
    verification: [],
    disagreements: [],
    limitations: [],
  };

  const HEAD_REVIEW_EN = Object.assign({}, HEAD_REVIEW_KA, {
    language: "en",
    headline: "Two weeks of bilateral evening headache without red flags",
    executive_summary:
      "42-year-old woman with two weeks of bilateral, band-like, non-pulsating evening headache without associated symptoms, in the context of stress and short sleep. Tension-type headache is most likely.",
    clinical_picture: {
      timeline: [{ when: "2 weeks ago", what: "Evening headaches began", source_ids: ["h1"] }],
      key_positives: [
        { text: "Band-like, non-pulsating pain", source_ids: ["h2"] },
        { text: "Stress and short sleep", source_ids: ["h4"] },
      ],
      key_negatives: [{ text: "No nausea, photophobia or visual disturbance", source_ids: ["h3"] }],
      unknowns: [],
      contradictions: [],
    },
    assessment: {
      status: "LEADING_CLINICAL_CONSIDERATION",
      statement: "Tension-type headache is most likely; no red flags are present.",
      leading: {
        condition: "Tension-type headache",
        why: "Bilateral band-like pain, clear triggers and no associated symptoms.",
        supporting: [{ text: "Band-like character", source_ids: ["h2"] }],
        against: [],
        missing: ["Blood pressure"],
      },
    },
    differential: [
      { condition: "Tension-type headache", weight: "stronger", why: "Typical character and triggers.", supporting: [], against: [], missing: [] },
      { condition: "Migraine without aura", weight: "less_likely", why: "Evening episodes.", supporting: [], against: ["Non-pulsating", "No nausea"], missing: [] },
    ],
    action_plan: [
      { step: 1, kind: "exam", title: "Blood pressure and neurological screen", detail: "", why: "To exclude a secondary cause.", branches: [] },
      { step: 2, kind: "decision", title: "Sleep hygiene and limited analgesic use", detail: "", why: "Prevents medication-overuse headache.", branches: [] },
    ],
  });

  const EXTRA = {
    "MI-2026-0412": {
      case: {
        answers: CHEST_ANSWERS,
        context: [{ label: "ქრონიკული დაავადებები", value: "შაქრიანი დიაბეტი", status: "stated" }],
        interview: { question_count: 4, completion_reason: "SAFETY_ESCALATION", completion_label: "" },
        patient: { city: "ქუთაისი", phone: "+995 555 00 00 01" },
      },
      reviews: { ka: CHEST_REVIEW_KA, en: CHEST_REVIEW_EN },
      decision: null,
    },
    "MI-2026-0407": {
      case: {
        answers: [
          { id: "t1", n: 1, question: "როდის დაიწყო ყელის ტკივილი?", answer: "გუშინ საღამოს.", note: "", topic: "დაწყება" },
          { id: "t2", n: 2, question: "გაქვთ ცხელება?", answer: "მგონი მაქვს, არ გამიზომავს.", note: "", topic: "ცხელება" },
        ],
      },
      reviews: {},
      decision: null,
    },
    "MI-2026-0402": {
      case: {
        answers: [
          { id: "k1", n: 1, question: "როდის დაიწყო ხველა?", answer: "ერთი კვირის წინ, სურდოსთან ერთად.", note: "", topic: "დაწყება" },
          { id: "k2", n: 2, question: "ნახველი გამოგყოფთ?", answer: "ცოტა, გამჭვირვალე.", note: "", topic: "ხველა" },
          { id: "k3", n: 3, question: "ქოშინი ან მკერდის ტკივილი გაქვთ?", answer: "არა.", note: "", topic: "სუნთქვა" },
        ],
      },
      reviews: {},
      decision: {
        assessment: "სავარაუდოდ ვირუსული ზედა სასუნთქი გზების ინფექცია.",
        plan: "",
        note: "",
        status: "draft",
        author: "დრ. ნინო ხელაძე",
        role: "CLINICIAN",
        updated_at: "2026-10-03T08:20:00Z",
        finalized_at: null,
      },
    },
    "MI-2026-0398": {
      case: { answers: HEAD_ANSWERS, final_note: "ჩაის ბევრს ვსვამ საღამოობით." },
      reviews: { ka: HEAD_REVIEW_KA, en: HEAD_REVIEW_EN },
      decision: {
        assessment: "დაძაბულობის ტიპის თავის ტკივილი.",
        plan: "წნევის კონტროლი, ძილის რეჟიმი, პარაცეტამოლი საჭიროებისამებრ, კვირაში 2 დღეზე ნაკლებ.",
        note: "განმეორებითი ვიზიტი 4 კვირაში ან ადრე, საგანგაშო ნიშნების შემთხვევაში.",
        status: "final",
        author: "დრ. ნინო ხელაძე",
        role: "CLINICIAN",
        updated_at: "2026-10-02T16:30:00Z",
        finalized_at: "2026-10-02T16:30:00Z",
      },
    },
  };

  const ROLES = {
    ADMIN: ["cases:read", "clinical:read", "decision:write", "workflow:write"],
    CLINICIAN: ["cases:read", "clinical:read", "decision:write", "workflow:write"],
    REVIEWER: ["cases:read", "clinical:read", "workflow:write"],
    CLINIC_STAFF: ["cases:read"],
  };
  const NAMES = {
    ADMIN: "სადემონსტრაციო ადმინისტრატორი",
    CLINICIAN: "დრ. ნინო ხელაძე",
    REVIEWER: "დრ. ლაშა ბერიძე",
    CLINIC_STAFF: "მარიამ გოგოლაძე",
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function shiftDates(value, offset) {
    if (Array.isArray(value)) return value.map((v) => shiftDates(v, offset));
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/_at$/.test(k) && typeof v === "string" && Number.isFinite(Date.parse(v))) out[k] = new Date(Date.parse(v) + offset).toISOString();
      else out[k] = shiftDates(v, offset);
    }
    return out;
  }

  function createApi(params) {
    const role = ROLES[params.get("role")] ? params.get("role") : "CLINICIAN";
    const perms = ROLES[role];
    const clinical = perms.includes("clinical:read");
    const failGen = params.get("gen") === "fail";
    let authed = params.get("auth") !== "0";
    const mode = params.get("auth") === "0" ? "key" : "local-dev";

    const summaries = DATA.cases.cases;
    const newest = Math.max(...summaries.map((c) => Date.parse(c.updated_at)));
    const offset = Date.now() - 6 * 60000 - newest;
    const mainId = DATA.case.case.case_id;
    const store = {};
    const order = [];
    for (const raw of shiftDates(clone(summaries), offset)) {
      const id = raw.case_id;
      const extra = EXTRA[id] || {};
      let detail;
      if (id === mainId) {
        detail = shiftDates(clone(DATA.case.case), offset);
      } else {
        const add = clone(extra.case || {});
        detail = Object.assign({}, raw, {
          patient: Object.assign(
            { father_name: "", dob: "", phone: "", email: "", address: "", city: "", insurance: "" },
            raw.patient,
            add.patient || {}
          ),
          context: add.context || [],
          answers: add.answers || [],
          final_note: add.final_note || "",
          contradictions: [],
          interview: add.interview || { question_count: raw.question_count, completion_reason: raw.completion_reason, completion_label: "" },
        });
      }
      const reviews = id === mainId ? { ka: DATA.case.review, en: MAIN_REVIEW_EN } : extra.reviews || {};
      const ready = raw.review_status === "ready" && reviews.ka;
      store[id] = {
        summary: raw,
        detail,
        reviews,
        review: ready ? shiftDates(clone(reviews.ka), offset) : null,
        status: ready ? "ready" : raw.review_status === "ready" ? "not_started" : raw.review_status,
        decision: id === mainId ? clone(DATA.case.decision) : shiftDates(clone(extra.decision || null), offset),
        gen: null,
      };
      order.push(id);
    }

    const wait = (ms) => new Promise((resolve) => root.setTimeout(resolve, ms));
    function fail(status, code) {
      const err = new Error(code);
      err.status = status;
      err.code = code;
      return err;
    }
    function session() {
      return authed
        ? { authenticated: true, role, name: NAMES[role], permissions: perms.slice(), mode }
        : { authenticated: false, role: null, name: "", permissions: [], mode: "key" };
    }
    function guard(perm) {
      if (!authed) throw fail(401, "unauthorized");
      if (perm && !perms.includes(perm)) throw fail(403, "forbidden");
    }
    function entry(id) {
      const e = store[id];
      if (!e) throw fail(404, "not_found");
      tick(e);
      return e;
    }
    function tick(e) {
      if (!e.gen || Date.now() < e.gen.until) return;
      const r = e.reviews[e.gen.language];
      if (r && !failGen) {
        e.review = Object.assign(clone(r), { generated_at: new Date().toISOString() });
        e.status = "ready";
      } else {
        e.status = "failed";
      }
      e.gen = null;
    }
    function summary(e) {
      const s = clone(e.summary);
      s.workflow = e.detail.workflow;
      s.review_status = e.status;
      s.decision_status = e.decision ? e.decision.status : "none";
      if (e.review && e.review.assessment) {
        s.assessment_status = e.review.assessment.status || "";
        s.leading_condition = (e.review.assessment.leading && e.review.assessment.leading.condition) || "";
      }
      if (!clinical) {
        s.assessment_status = "";
        s.leading_condition = "";
        s.headline = "";
      }
      return s;
    }
    function staffDecision(dec) {
      if (!dec) return null;
      return { assessment: "", plan: "", note: "", status: dec.status, author: dec.author, role: dec.role, updated_at: dec.updated_at, finalized_at: dec.finalized_at };
    }

    return {
      async session() {
        await wait(150);
        return session();
      },
      async login(key) {
        await wait(400);
        if (String(key || "").trim() !== "demo") throw fail(401, "invalid_key");
        authed = true;
        return session();
      },
      async logout() {
        await wait(100);
        authed = false;
        return { ok: true };
      },
      async cases() {
        await wait(300);
        guard("cases:read");
        return { cases: order.map((id) => summary(entry(id))) };
      },
      async getCase(id) {
        await wait(350);
        guard("cases:read");
        const e = entry(id);
        const detail = Object.assign(clone(e.detail), summary(e), { patient: clone(e.detail.patient) });
        if (!clinical) {
          Object.assign(detail, { answers: [], context: [], final_note: "", contradictions: [], headline: "" });
          return { case: detail, review: null, review_status: e.status, decision: staffDecision(e.decision) };
        }
        return { case: detail, review: clone(e.review), review_status: e.gen ? "generating" : e.status, decision: clone(e.decision) };
      },
      async generate(id, language) {
        await wait(300);
        guard("clinical:read");
        const e = entry(id);
        e.gen = { language: language === "en" ? "en" : "ka", until: Date.now() + 4500 };
        e.status = "generating";
        return { review_status: "generating", review: null };
      },
      async saveDecision(id, fields, status) {
        await wait(250);
        guard("decision:write");
        const e = entry(id);
        if (e.decision && e.decision.status === "final") throw fail(409, "decision_final");
        const now = new Date().toISOString();
        e.decision = {
          assessment: String(fields.assessment || ""),
          plan: String(fields.plan || ""),
          note: String(fields.note || ""),
          status: status === "final" ? "final" : "draft",
          author: NAMES[role],
          role,
          updated_at: now,
          finalized_at: status === "final" ? now : null,
        };
        return { decision: clone(e.decision) };
      },
      async setWorkflow(id, workflow) {
        await wait(200);
        guard("workflow:write");
        const e = entry(id);
        if (!["new", "in_review", "reviewed"].includes(workflow)) throw fail(400, "invalid_workflow");
        e.detail.workflow = workflow;
        return { workflow };
      },
    };
  }

  root.REVIEW_FIXTURES = { data: DATA, createApi };
})(window);
