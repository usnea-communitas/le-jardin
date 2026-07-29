# Permaculture Garden — Le Jardin: localization glossary

Version: 1.0
Locales: `en`, `cs`, `de`, `fr`, `es`, `pt-BR`, `pl`, `ru`, `zh-CN`
Purpose: the binding terminology and voice reference for interface copy, the Garden Book, onboarding, challenges, Living Lessons, subtitles and Czech voice production.

## 1. Non-negotiable voice

The game is poetic, warm, adventurous and quietly motivating. It is written for young people, but it must never sound childish, sugary or like a school worksheet.

- The Garden speaks in the first person as a living place, not as a fantasy mascot. It notices relationships, remembers seasons and invites action; it does not claim supernatural or scientific certainty.
- Prefer concrete sensory language: roots, shade, damp soil, flowering time, a gift crossing the gate. Avoid generic inspiration such as “unlock your potential”, “magical journey” or “save the planet”.
- Keep educational uncertainty intact. Use “may”, “can support”, “under the right conditions”, “observe” and “is not guaranteed” wherever the English source does. Never strengthen a possibility into a promise.
- The player is addressed informally and directly: Czech `ty`, German `du`, French `tu`, Spanish `tú`, Brazilian Portuguese `você`, Polish `ty`, Russian `ты`, Simplified Chinese `你`.
- Avoid gendering the player. Prefer an imperative or a sentence without a past participle referring to the player.
- Use sentence case for headings and buttons, except where the target language requires noun capitalization. Do not reproduce English Title Case mechanically.
- A short UI label may be concise, but the Garden Book must retain the scientific nuance behind it.
- “Wildlife” should often become “wild neighbours” in narrative copy. The animals are neither rewards nor guaranteed workers.
- A gift is not a purchase, barter or promise of repayment. Keep that distinction explicit.

### Locale-specific voice

| Locale | Voice rule |
|---|---|
| `cs` | Natural contemporary Czech, warm but not cute. Use `ty` and clear imperatives. The speaking **zahrada** is grammatically feminine: `vyrostla jsem`, if a gendered past form cannot be avoided. Prefer `semeno` in educational text; do not overuse diminutives such as `semínko`, `zvířátko` or `zahrádka`. |
| `de` | Use `du`, not `Sie`. Prefer calm, concrete verbs and natural compounds. The tone may be lyrical, but avoid grandiose environmental slogans. Keep `ß`, umlauts and proper German noun capitalization. |
| `fr` | Use `tu`, not `vous`. The speaking **jardin** is masculine where agreement is visible. Prefer neutral restructuring over typographic gender forms in compact UI. Use French spacing and apostrophes correctly. |
| `es` | Use neutral international Spanish and `tú`. Because the setting is European, `patata`, `otoño` and `ordenador`-neutral phrasing are acceptable; avoid strongly regional slang. Use opening question/exclamation marks. |
| `pt-BR` | Brazilian Portuguese only. Use `você` and Brazilian gardening terms such as `canteiro`, `hortaliça`, `cobertura morta` and `joaninha`. Do not import European Portuguese forms such as `tu` conjugations or `ficheiro`. |
| `pl` | Natural contemporary Polish using informal singular `ty`. Prefer direct imperatives and idiomatic Polish syntax over English calques. The speaking **ogród** is grammatically masculine where agreement is unavoidable. Preserve Polish diacritics. Runtime placeholders may contain nouns of different genders, so restructure rather than forcing an unsafe adjective or article onto `{name}`, `{item}` or similar placeholders. |
| `ru` | Use `ты`, but omit the pronoun when a natural imperative is enough. The speaking **сад** is grammatically masculine if agreement is unavoidable. Write `ё` where it belongs (`ёж`, `всё`) instead of silently replacing it with `е`. |
| `zh-CN` | Simplified Chinese only. Use `你`, short natural clauses and Chinese punctuation. Do not imitate English syntax, insert spaces between Chinese characters, or use Traditional characters. The Garden should sound observant and calm, not like a cartoon narrator. |

### Polish binding addendum

Use these Polish terms consistently even though the comparison tables below predate the Polish column:

| English source | Polish `pl` |
|---|---|
| permaculture | permakultura |
| Care for Earth | troska o Ziemię |
| Care for people | troska o ludzi |
| fair share | sprawiedliwy podział |
| genuine surplus | rzeczywista nadwyżka |
| living soil | żywa gleba |
| water security *(garden metric)* | odporność wodna |
| food web | sieć pokarmowa |
| habitat | siedlisko |
| Garden Book | Księga ogrodu |
| Garden voice | głos ogrodu |
| community sharing table | społeczny stół dzielenia się |
| community pool | wspólna pula |
| Shares *(game token)* | punkty zaangażowania |
| design connection | połączenie projektowe |
| full plant guild | pełna gildia roślin |
| seed bank | społeczny bank nasion |
| mulch / no-dig | ściółka / uprawa bez przekopywania |
| seasonal turn | tura sezonu |
| Spring / Summer / Autumn / Winter | wiosna / lato / jesień / zima |

## 2. Names that are not translated

Keep the following spellings in every locale:

- **Le Jardin**
- **Menet**
- **GPT‑5.6 Luna**
- The official title **Permaculture Garden — Le Jardin**
- Personal names: **Camille, Noa, Léa, Malik, Anaïs, Baptiste**
- Scientific names such as *Stropharia rugosoannulata*, *Pleurotus ostreatus* and *Agrocybe praecox*

Rules:

- Do not translate the French article in **Le Jardin**.
- Do not decline, respell or transliterate **Menet** in visible UI. For speech, follow the pronunciation in the already approved reference narration; do not guess from the target language’s spelling rules.
- Keep **GPT‑5.6 Luna** together. `GPT‑5.6` is not a generic “AI” label and `Luna` is not translated.
- Personal names retain their accents. A locale may add a pronunciation hint in production notes, never inside player-facing text.
- Internal IDs, file paths, storage keys, locale codes and API field names are never localized.

## 3. Core permaculture ethics and game systems

| English source | Czech `cs` | German `de` | French `fr` | Spanish `es` | Portuguese `pt-BR` | Russian `ru` | Chinese `zh-CN` |
|---|---|---|---|---|---|---|---|
| permaculture | permakultura | Permakultur | permaculture | permacultura | permacultura | пермакультура | 朴门永续设计 |
| Care for Earth | péče o Zemi | Sorge für die Erde | prendre soin de la Terre | cuidar la Tierra | cuidar da Terra | забота о Земле | 关爱地球 |
| Care for people | péče o lidi | Sorge für die Menschen | prendre soin des personnes | cuidar a las personas | cuidar das pessoas | забота о людях | 关爱人类 |
| fair share | spravedlivé sdílení | gerechtes Teilen | partage équitable | reparto justo | partilha justa | справедливое распределение | 公平分享（分享盈余） |
| genuine surplus | skutečný přebytek | echter Überschuss | véritable surplus | excedente real | excedente real | настоящий излишек | 真正的盈余 |
| garden resilience | odolnost zahrady | Widerstandsfähigkeit des Gartens | résilience du jardin | resiliencia del jardín | resiliência do jardim | устойчивость сада | 花园韧性 |
| living soil | živá půda | lebendiger Boden | sol vivant | suelo vivo | solo vivo | живая почва | 有生命力的土壤 |
| water security *(garden metric)* | vodní odolnost | Wasserresilienz | résilience hydrique | resiliencia hídrica | resiliência hídrica | водная устойчивость сада | 水资源韧性 |
| food web | potravní síť | Nahrungsnetz | réseau trophique | red trófica | teia alimentar | пищевая сеть | 食物网 |
| habitat | životní prostor *(odborně: stanoviště)* | Lebensraum | habitat | hábitat | habitat | среда обитания | 栖息地 |
| connected habitat | propojený životní prostor | vernetzter Lebensraum | habitat connecté | hábitat conectado | habitat conectado | связанная среда обитания | 连通的栖息地 |
| soil & nutrient cycling | půda a koloběh živin | Boden & Nährstoffkreislauf | sol et cycle des nutriments | suelo y ciclo de nutrientes | solo e ciclagem de nutrientes | почва и круговорот питательных веществ | 土壤与养分循环 |
| water care | péče o vodu | Umgang mit Wasser | soin de l’eau | cuidado del agua | cuidado com a água | забота о воде | 水资源呵护 |
| food, seed & season | jídlo, osivo a roční období | Nahrung, Saatgut & Jahreszeit | nourriture, semences et saisons | alimentos, semillas y estaciones | alimentos, sementes e estações | пища, семена и времена года | 食物、种子与季节 |
| people & learning | lidé a učení | Menschen & Lernen | personnes et apprentissage | personas y aprendizaje | pessoas e aprendizagem | люди и обучение | 人与学习 |
| four living layers | čtyři živé vrstvy | vier lebendige Ebenen | quatre strates vivantes | cuatro capas vivas | quatro camadas vivas | четыре живых слоя | 四个生命层次 |
| guided path | provázená cesta | begleiteter Weg | parcours guidé | recorrido guiado | jornada guiada | путь с подсказками | 引导模式 |
| explore freely | volné objevování | frei erkunden | explorer librement | explorar libremente | explorar livremente | свободное исследование | 自由探索 |
| Garden Book | Zahradní kniha | Gartenbuch | Livre du jardin | Libro del jardín | Livro do jardim | Книга сада | 花园之书 |
| Garden voice | hlas zahrady | Stimme des Gartens | voix du jardin | voz del jardín | voz do jardim | голос сада | 花园之声 |
| community sharing table | komunitní stůl sdílení | gemeinschaftlicher Gabentisch | table de partage communautaire | mesa comunitaria para compartir | mesa comunitária de partilha | общий стол даров | 社区分享桌 |
| community pool | společná zásoba | Gemeinschaftsvorrat | réserve commune | reserva comunitaria | reserva comunitária | общий запас | 社区共享储备 |
| sharing act | akt sdílení | Handlung des Teilens | acte de partage | acto de compartir | ato de partilha | акт дарения | 分享行动 |
| genuine gift | opravdový dar | echtes Geschenk | don véritable | regalo genuino | presente genuíno | настоящий дар | 真正的赠予 |
| basket | košík | Korb | panier | cesta | cesta | корзина | 篮子 |
| next season | další roční období | nächste Jahreszeit | saison suivante | siguiente estación | próxima estação | следующий сезон | 下一季 |

### Critical distinction: “Shares” is not “fair share”

In the game, **Shares** are participation tokens earned through noticing connections and participating in the community. They are not company shares, money, moral virtue or repayment for a gift.

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Shares *(game token)* | žetony zapojení; short: žetony | Mitmachpunkte | jetons de participation | fichas de participación | fichas de participação | жетоны участия | 参与点数 |
| 1 Share / n Shares | 1 žeton / n žetonů | 1 Mitmachpunkt / n Mitmachpunkte | 1 jeton / n jetons | 1 ficha / n fichas | 1 ficha / n fichas | 1 жетон / 2–4 жетона / 5+ жетонов | 1 参与点 / n 参与点 |

Never use Czech `akcie`, German `Anteile`, French `actions`, Spanish `acciones`, Portuguese `ações`, Russian `акции` or Chinese `股份`.

## 4. Seasons

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Spring | jaro | Frühling | printemps | primavera | primavera | весна | 春季 |
| Summer | léto | Sommer | été | verano | verão | лето | 夏季 |
| Autumn | podzim | Herbst | automne | otoño | outono | осень | 秋季 |
| Winter | zima | Winter | hiver | invierno | inverno | зима | 冬季 |
| seasonal turn | sezónní tah | Jahreszeitenrunde | tour de saison | turno estacional | rodada sazonal | сезонный ход | 季节回合 |
| full turn of four seasons | celý cyklus čtyř ročních období | ein voller Zyklus der vier Jahreszeiten | un cycle complet des quatre saisons | un ciclo completo de las cuatro estaciones | um ciclo completo das quatro estações | полный цикл из четырёх времён года | 完整的四季循环 |
| overwinter | přezimovat | überwintern | hiverner | pasar el invierno | passar o inverno | зимовать | 越冬 |
| dormant / dormancy | ve vegetačním klidu / vegetační klid | in Winterruhe / Winterruhe | en dormance / dormance | en reposo / dormancia | em dormência / dormência | в состоянии покоя / период покоя | 休眠中／休眠期 |

Season names are lowercase in Czech, French, Spanish, Portuguese and Russian prose. They are capitalized only when the language normally requires it or when standing at the beginning of a sentence.

## 5. Placeable elements and crops

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Compost | kompost | Kompost | compost | compost | composto | компост | 堆肥 |
| Hügelkultur bed | dřevem vyplněný vyvýšený záhon *(hügelkultur)* | Hügelbeet *(Hügelkultur)* | butte de culture sur bois *(hügelkultur)* | bancal elevado con madera *(hügelkultur)* | canteiro elevado com madeira *(hügelkultur)* | древесная холмистая грядка *(хюгелькультура)* | 木芯高畦（hügelkultur） |
| Rain harvesting | zachytávání dešťové vody | Regenwassernutzung | récupération d’eau de pluie | captación de agua de lluvia | captação de água da chuva | сбор дождевой воды | 雨水收集 |
| Mulch / no-dig | mulč / pěstování bez rytí | Mulch / grabenloser Anbau | paillis / culture sans bêchage | acolchado / cultivo sin labranza | cobertura morta / cultivo sem revolvimento do solo | мульча / огород без перекопки | 覆盖物／免耕种植 |
| Bug hotel | hmyzí hotel | Insektenhotel | hôtel à insectes | hotel de insectos | hotel de insetos | домик для насекомых | 昆虫旅馆 |
| Growing arch | oblouk pro popínavé rostliny | Rankbogen | arche pour plantes grimpantes | arco para trepadoras | arco para trepadeiras | арка для вьющихся растений | 攀援植物拱架 |
| Herb spiral | bylinková spirála | Kräuterspirale | spirale d’aromatiques | espiral de hierbas aromáticas | espiral de ervas | спиральная грядка для пряных трав | 香草螺旋花坛 |
| Flower strip | květinový pás | Blühstreifen | bande fleurie | franja floral | faixa de flores | полоса цветущих растений | 花带 |
| Greenhouse | skleník | Gewächshaus | serre | invernadero | estufa | теплица | 温室 |
| Seed bank | komunitní semínkovna | Saatgutbank | grainothèque | banco de semillas | banco de sementes | банк семян | 种子库 |
| Bird bath | ptačí pítko a koupátko | Vogeltränke | bain d’oiseaux | bebedero para aves | bebedouro para aves | поилка-купальня для птиц | 鸟浴盆 |
| Bird house / nest box | ptačí budka / hnízdní budka | Nistkasten | nichoir | caja nido | caixa-ninho | гнездовой ящик | 鸟类巢箱 |
| Bench | lavička | Bank | banc | banco | banco | скамейка | 长椅 |
| Garden sign | zahradní cedule | Gartenschild | panneau du jardin | cartel del jardín | placa do jardim | садовая табличка | 花园标牌 |
| Apple tree | jabloň | Apfelbaum | pommier | manzano | macieira | яблоня | 苹果树 |
| Garden kitchen | zahradní kuchyně | Gartenküche | cuisine du jardin | cocina del jardín | cozinha do jardim | садовая кухня | 花园厨房 |
| Potatoes | brambory | Kartoffeln | pommes de terre | patatas | batatas | картофель | 马铃薯 |
| Root vegetables | kořenová zelenina | Wurzelgemüse | légumes-racines | hortalizas de raíz | hortaliças de raiz | корнеплоды | 根菜类 |
| Leafy greens | listová zelenina | Blattgemüse | légumes-feuilles | verduras de hoja | hortaliças folhosas | листовая зелень | 叶菜类 |
| Cabbage | hlávkové zelí | Kopfkohl | chou pommé | repollo | repolho | кочанная капуста | 卷心菜 |
| Kitchen herbs | kuchyňské bylinky | Küchenkräuter | herbes aromatiques | hierbas aromáticas | ervas aromáticas | пряные травы | 烹饪香草 |
| Cherries | třešně | Kirschen | cerises | cerezas | cerejas | вишня / черешня podle skutečné odrůdy | 樱桃 |
| Apples | jablka | Äpfel | pommes | manzanas | maçãs | яблоки | 苹果 |

Notes:

- Keep **hügelkultur** as a parenthetical technical term, not as the only label. Never translate it as a universally “self-fertile” or “water-free” bed.
- French **grainothèque** fits this community exchange better than an institutional `banque de semences`.
- Czech **semínkovna** is the friendly UI term; use `komunitní banka osiva` in a formal explanation if needed.
- Chinese `马铃薯` is the canonical term. Do not alternate unpredictably with `土豆`.
- “Cabbage” here means a headed cabbage suitable for sauerkraut, not Chinese cabbage.

## 6. Wildlife and fungi

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| wildlife | volně žijící druhy; narrative: divocí sousedé | Wildtiere; narrative: wilde Nachbarn | faune sauvage; narrative: voisins sauvages | fauna silvestre; narrative: vecinos silvestres | vida silvestre; narrative: vizinhos silvestres | дикие животные; narrative: дикие соседи | 野生生物；叙事：野生邻居 |
| Earthworms | žížaly | Regenwürmer | vers de terre | lombrices | minhocas | дождевые черви | 蚯蚓 |
| Wine cap, *Stropharia rugosoannulata* | límcovka vrásčitoprstenná | Riesen-Träuschling | strophaire à anneau rugueux | seta de vino | cogumelo-vinho | строфария морщинисто-кольцевая | 大球盖菇 |
| Oyster mushroom, *Pleurotus ostreatus* | hlíva ústřičná | Austernseitling | pleurote en huître | seta de ostra | cogumelo-ostra | вёшенка обыкновенная | 平菇 |
| Field cap, *Agrocybe praecox* | polnička raná | Früher Ackerling | agrocybe précoce | agrocybe precoz | agrocybe precoce | агроцибе ранняя | 田头菇 |
| Bees | včely | Bienen | abeilles | abejas | abelhas | пчёлы | 蜜蜂 |
| Butterflies | motýli | Schmetterlinge | papillons | mariposas | borboletas | бабочки | 蝴蝶 |
| Birds | ptáci | Vögel | oiseaux | aves | aves | птицы | 鸟类 |
| Hedgehog | ježek | Igel | hérisson | erizo | ouriço-cacheiro | ёж | 刺猬 |
| Ladybugs / ladybirds | slunéčka *(čeleď Coccinellidae)* | Marienkäfer | coccinelles | mariquitas | joaninhas | божьи коровки | 瓢虫 |
| Beetles | brouci | Käfer | coléoptères | escarabajos | besouros | жуки | 甲虫 |

Safety rule for every locale:

- Show the scientific name the first time a mushroom species appears in the Garden Book.
- Never imply that an image, common name or this game can identify an edible mushroom.
- Translate “verified spawn” as cultivation material from a reliable source, not as wild-collected mycelium.
- “May visit”, “may use” and “can support” remain possibilities. Do not turn them into “will arrive”, “attracts” or “controls pests”.

## 7. Design connection versus full plant guild

This distinction is central to the game and must survive every translation.

### Canonical terms

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| design connection | návrhové propojení | Gestaltungsbeziehung | lien fonctionnel de conception | conexión de diseño | conexão de design | проектная связь | 设计关联 |
| pairwise design connection | návrhové propojení dvou prvků | Gestaltungsbeziehung zwischen zwei Elementen | lien de conception entre deux éléments | conexión de diseño entre dos elementos | conexão de design entre dois elementos | проектная связь между двумя элементами | 两个元素之间的设计关联 |
| active connection | aktivní propojení | aktive Beziehung | lien actif | conexión activa | conexão ativa | активная связь | 有效关联 |
| complementary partners | vzájemně se doplňující prvky | einander ergänzende Elemente | éléments complémentaires | elementos complementarios | elementos complementares | взаимодополняющие элементы | 互补元素 |
| needs and yields | potřeby a výstupy | Bedürfnisse und Erträge | besoins et productions | necesidades y aportes | necessidades e resultados | потребности и отдача | 需求与产出 |
| full plant guild | plné rostlinné společenstvo *(permakulturní cech)* | vollständige Pflanzengilde | guilde végétale complète | gremio vegetal completo | guilda de plantas completa | полноценная растительная гильдия | 完整的互助植物组合（植物公会） |

Required meaning:

> A **design connection** is one observed or proposed useful relationship between two nearby elements. A **full plant guild** combines several compatible species and functions into a community. One pair is a beginning, not a full guild.

Never shorten this into “you created a guild” when the player has only formed one pair. In Chinese, do not use `公会` by itself; first write `互助植物组合（植物公会）` so it is not mistaken for a gaming guild or trade association.

### Names of the eight in-game connections

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Hot-bed idea | nápad na teplý záhon | Idee für ein Warmbeet | idée de couche chaude | idea de cama caliente | ideia de cama quente | идея тёплой грядки | 堆肥温床构想 |
| Drip corner | zavlažovaný bylinkový kout | Kräuterecke mit Tropfbewässerung | coin d’aromatiques au goutte-à-goutte | rincón de aromáticas con riego por goteo | canto de ervas com irrigação por gotejamento | уголок трав с капельным поливом | 滴灌香草角 |
| Food forest corner | koutek jedlého lesa | Waldgarten-Ecke | coin de forêt-jardin nourricière | rincón de bosque comestible | canto de floresta de alimentos | уголок съедобного леса | 食物森林一角 |
| Pollinator paradise | ráj pro opylovače | Paradies für Bestäuber | paradis des pollinisateurs | paraíso para polinizadores | paraíso dos polinizadores | рай для опылителей | 传粉者乐园 |
| Living seed library | živá semínkovna | lebendige Saatgutbibliothek | grainothèque vivante | biblioteca viva de semillas | biblioteca viva de sementes | живая библиотека семян | 活的种子库 |
| Outdoor classroom | venkovní učebna | Klassenzimmer im Freien | classe en plein air | aula al aire libre | sala de aula ao ar livre | класс под открытым небом | 户外课堂 |
| Nectar and cover | nektar a úkryt | Nektar und Deckung | nectar et couvert | néctar y refugio | néctar e abrigo | нектар и укрытие | 花蜜与庇护 |
| Bird neighbours | ptačí sousedé | gefiederte Nachbarn | voisins ailés | vecinos alados | vizinhos alados | пернатые соседи | 鸟类邻居 |

These names may stay poetic. Their explanatory text must retain the caveats about site, species, weather and observation.

## 8. Living Lesson

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Living Lesson | Živá lekce | Lebendige Lektion | Leçon vivante | Lección viva | Lição viva | Живой урок | 生命课 |
| garden reflection | zamyšlení se zahradou | Gartenreflexion | réflexion avec le jardin | reflexión con el jardín | reflexão com o jardim | размышление вместе с садом | 与花园一起反思 |
| observable relationship | pozorovatelný vztah | beobachtbare Beziehung | relation observable | relación observable | relação observável | наблюдаемая связь | 可观察的关系 |
| measurable experiment | měřitelný pokus | messbares Experiment | expérience mesurable | experimento medible | experimento mensurável | измеримый эксперимент | 可衡量的实验 |
| baseline | výchozí hodnota | Ausgangswert | valeur initiale | valor inicial | valor inicial | исходное значение | 初始值 |
| target | cílová hodnota | Zielwert | valeur cible | valor objetivo | meta | целевое значение | 目标值 |
| check the result | ověřit výsledek | Ergebnis prüfen | vérifier le résultat | comprobar el resultado | verificar o resultado | проверить результат | 检查结果 |
| reviewed offline lesson | ověřená offline lekce | geprüfte Offline-Lektion | leçon hors ligne validée | lección sin conexión revisada | lição offline revisada | проверенный офлайн-урок | 经审核的离线课程 |
| suggested by GPT‑5.6 Luna | navrhla GPT‑5.6 Luna | vorgeschlagen von GPT‑5.6 Luna | proposé par GPT‑5.6 Luna | sugerido por GPT‑5.6 Luna | sugerido por GPT‑5.6 Luna | предложено GPT‑5.6 Luna | 由 GPT‑5.6 Luna 建议 |

The title may be translated, but **GPT‑5.6 Luna** is always preserved. Player-facing copy should explain an action and an observable relationship; it should not expose implementation vocabulary such as `state fingerprint`, `structured output`, `cache key`, `token cap` or `fallback candidate`.

If AI is unavailable, use the localized reviewed lesson without apologetic technical copy. Clearly mark it as available offline; never imply that GPT generated it.

## 9. Learning challenges and principles

| English source | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| Soil moisture rescue | záchrana vláhy v půdě | Rettung der Bodenfeuchte | préserver l’humidité du sol | rescatar la humedad del suelo | preservar a umidade do solo | сохранить влагу в почве | 守住土壤水分 |
| Observe & conserve | pozoruj a šetři zdroji | beobachten und bewahren | observer et préserver | observar y conservar | observar e conservar | наблюдать и беречь | 观察并珍惜资源 |
| Feed the compost | nakrm kompost | den Kompost füttern | nourrir le compost | alimentar el compost | alimentar a compostagem | накормить компост | 给堆肥补料 |
| Turn waste into fertility | proměň odpad v úrodnost | Abfall wird zu Fruchtbarkeit | transformer les déchets en fertilité | convertir los residuos en fertilidad | transformar resíduos em fertilidade | превращать отходы в плодородие | 变废为肥 |
| Test a layered wood bed | vyzkoušej vrstvený záhon se dřevem | ein geschichtetes Holzbeet testen | tester une butte de culture sur bois | probar un bancal de madera por capas | testar um canteiro de madeira em camadas | испытать слоистую древесную грядку | 测试分层木芯高畦 |
| Observe experimental systems | pozoruj experimentální systémy | experimentelle Systeme beobachten | observer les systèmes expérimentaux | observar los sistemas experimentales | observar sistemas experimentais | наблюдать за экспериментальными системами | 观察实验性系统 |
| Guide every drop | veď každou kapku | jeden Tropfen lenken | guider chaque goutte | guiar cada gota | guiar cada gota | направить каждую каплю | 引导每一滴水 |
| Slow, spread & sink | zpomal, rozveď a nech vsáknout | bremsen, verteilen und versickern lassen | ralentir, répartir et infiltrer | frenar, distribuir e infiltrar | desacelerar, espalhar e infiltrar | замедлить, распределить и дать впитаться | 减速、分散、下渗 |
| Plan the winter pantry | naplánuj zimní spižírnu | den Wintervorrat planen | préparer le garde-manger d’hiver | planificar la despensa de invierno | planejar a despensa de inverno | спланировать зимние запасы | 规划冬季储藏 |
| Store surplus wisely | uchovej přebytky s rozmyslem | Überschüsse sinnvoll lagern | conserver les surplus avec soin | conservar los excedentes con criterio | conservar os excedentes com cuidado | разумно сохранять излишки | 妥善保存盈余 |
| Restore the balance | obnov rovnováhu | das Gleichgewicht wiederherstellen | rétablir l’équilibre | recuperar el equilibrio | restaurar o equilíbrio | восстановить равновесие | 恢复平衡 |
| Work with living systems | spolupracuj s živými systémy | mit lebenden Systemen arbeiten | agir avec les systèmes vivants | trabajar con sistemas vivos | trabalhar com sistemas vivos | работать вместе с живыми системами | 与生命系统协作 |
| Keep the nectar flowing | ať nektar proudí celou sezónu | den Nektarfluss erhalten | maintenir le nectar au fil des saisons | mantener el néctar durante las estaciones | manter o néctar ao longo das estações | сохранить непрерывное цветение | 让花蜜贯穿花季 |
| Design through time | navrhuj v čase | über die Zeit gestalten | concevoir dans le temps | diseñar a lo largo del tiempo | projetar ao longo do tempo | проектировать с учётом времени | 跨时间设计 |
| Make room for winter | udělej místo zimnímu životu | Raum für den Winter schaffen | faire une place à la vie en hiver | hacer sitio para la vida en invierno | abrir espaço para a vida no inverno | создать место для зимней жизни | 为冬日生命留出空间 |
| Fair share for wildlife | spravedlivý díl i pro divoké sousedy | Raum gerecht mit Wildtieren teilen | partage équitable avec la faune sauvage | reparto justo con la fauna silvestre | partilha justa com a vida silvestre | справедливо делиться с дикими соседями | 与野生邻居公平共享 |
| Complete the connection | dokonči propojení | die Verbindung vervollständigen | compléter le lien | completar la conexión | completar a conexão | завершить связь | 完成关联 |
| Connect, don’t collect | propojuj, nehromaď | verbinden statt sammeln | relier plutôt qu’accumuler | conectar, no acumular | conectar, não acumular | связывать, а не накапливать | 重在关联，而非堆砌 |
| Choose tomorrow’s seeds | vyber semena pro zítřek | Saatgut für morgen wählen | choisir les semences de demain | elegir las semillas de mañana | escolher as sementes de amanhã | выбрать семена на завтра | 选择明天的种子 |
| Save what thrives | uchovej semena toho, čemu se daří | Saatgut von Bewährtem bewahren | conserver les graines de ce qui prospère | guardar semillas de lo que prospera | guardar sementes do que prospera | сохранять семена того, что процветает | 留下长势良好者的种子 |
| Read the garden | čti v zahradě | den Garten lesen | lire le jardin | leer el jardín | ler o jardim | читать сад | 读懂花园 |
| Observe before acting | nejdřív pozoruj, potom jednej | erst beobachten, dann handeln | observer avant d’agir | observar antes de actuar | observar antes de agir | сначала наблюдать, потом действовать | 行动前先观察 |
| The problem is the solution | problém je řešení | das Problem ist die Lösung | le problème est la solution | el problema es la solución | o problema é a solução | проблема — это решение | 问题就是解决方案 |

## 10. Specialist terminology

### Soil, compost and plant growth

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| nutrient cycling | koloběh živin | Nährstoffkreislauf | cycle des nutriments | ciclo de nutrientes | ciclagem de nutrientes | круговорот питательных веществ | 养分循环 |
| organic matter | organická hmota | organische Substanz | matière organique | materia orgánica | matéria orgânica | органическое вещество | 有机质 |
| soil structure | půdní struktura | Bodenstruktur | structure du sol | estructura del suelo | estrutura do solo | структура почвы | 土壤结构 |
| soil moisture | půdní vlhkost | Bodenfeuchte | humidité du sol | humedad del suelo | umidade do solo | влажность почвы | 土壤水分 |
| surface cover | půdní pokryv | Bodenbedeckung | couverture du sol | cobertura del suelo | cobertura do solo | почвенный покров | 地表覆盖 |
| fungal network | síť podhoubí | Myzelnetzwerk | réseau mycélien | red de micelio | rede micelial | сеть мицелия | 菌丝网络 |
| decomposer fungi | rozkladné houby | zersetzende Pilze | champignons décomposeurs | hongos descomponedores | fungos decompositores | грибы-сапротрофы | 分解真菌 |
| nitrogen-rich “greens” | dusíkaté „zelené“ složky | stickstoffreiche Grünmaterialien | matières vertes riches en azote | materiales verdes ricos en nitrógeno | materiais verdes ricos em nitrogênio | богатые азотом «зелёные» материалы | 富氮“绿料” |
| carbon-rich “browns” | uhlíkaté „hnědé“ složky | kohlenstoffreiche Braunmaterialien | matières brunes riches en carbone | materiales marrones ricos en carbono | materiais marrons ricos em carbono | богатые углеродом «коричневые» материалы | 富碳“棕料” |
| aeration | provzdušnění | Belüftung | aération | aireación | aeração | аэрация | 通气 |
| nitrogen fixation | biologická fixace dusíku | biologische Stickstofffixierung | fixation biologique de l’azote | fijación biológica de nitrógeno | fixação biológica de nitrogênio | биологическая фиксация азота | 生物固氮 |
| root nodules | kořenové hlízky | Wurzelknöllchen | nodosités racinaires | nódulos radiculares | nódulos radiculares | корневые клубеньки | 根瘤 |
| bolting *(leafy crop)* | vybíhání do květu | Schossen | montée en graines | espigado | pendoamento | стрелкование | 抽薹 |
| late blight | plíseň bramborová | Kraut- und Knollenfäule | mildiou de la pomme de terre | tizón tardío *(mildiu de la patata)* | requeima da batata | фитофтороз картофеля | 马铃薯晚疫病 |
| grafted apple tree | roubovaná jabloň | veredelter Apfelbaum | pommier greffé | manzano injertado | macieira enxertada | привитая яблоня | 嫁接苹果树 |
| compatible cultivar | kompatibilní odrůda | kompatible Sorte | variété compatible | variedad compatible | cultivar compatível | совместимый сорт | 花期相容的品种 |

Do not translate `greens` and `browns` as colour alone. They are functional compost categories and must include nitrogen/carbon on first use.

### Water

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| gravity-fed irrigation | samospádové zavlažování | Schwerkraftbewässerung | irrigation gravitaire | riego por gravedad | irrigação por gravidade | самотечный полив | 重力灌溉 |
| screened inlet | přívod se sítkem | Zulauf mit Schutzgitter | arrivée munie d’un filtre | entrada con malla | entrada com tela | вход с защитной сеткой | 带滤网的进水口 |
| overflow | bezpečný přepad | sicherer Überlauf | trop-plein sécurisé | rebosadero seguro | extravasor seguro | безопасный перелив | 安全溢流口 |
| non-potable water | nepitná užitková voda | nicht als Trinkwasser geeignetes Wasser | eau non potable | agua no potable | água não potável | непитьевая вода | 非饮用水 |
| infiltration area | vsakovací plocha | Versickerungsfläche | zone d’infiltration | zona de infiltración | área de infiltração | зона инфильтрации | 下渗区 |
| swale | vsakovací průleh *(swale)* | Versickerungsmulde *(Swale)* | noue d’infiltration | zanja de infiltración *(swale)* | vala de infiltração em nível *(swale)* | инфильтрационная канава по контуру *(свейл)* | 等高渗水沟 |
| mosquito screen | síťka proti komárům | Mückenschutzgitter | moustiquaire | malla antimosquitos | tela contra mosquitos | противомоскитная сетка | 防蚊网 |
| evaporation | odpařování | Verdunstung | évaporation | evaporación | evaporação | испарение | 蒸发 |

`Water security` in this game is a garden resilience score. It must not be phrased as a claim that stored roof water is safe drinking water.

### Pollination, seed and preservation

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| pollinator | opylovač | Bestäuber | pollinisateur | polinizador | polinizador | опылитель | 传粉者 |
| pollination | opylení | Bestäubung | pollinisation | polinización | polinização | опыление | 授粉 |
| nectar / pollen | nektar / pyl | Nektar / Pollen | nectar / pollen | néctar / polen | néctar / pólen | нектар / пыльца | 花蜜／花粉 |
| open-pollinated variety | volně opylovaná odrůda | samenfeste, offen bestäubte Sorte | variété à pollinisation libre | variedad de polinización abierta | variedade de polinização aberta | сорт открытого опыления | 开放授粉品种 |
| hybrid seed | hybridní osivo | Hybridsaatgut | semence hybride | semilla híbrida | semente híbrida | гибридные семена | 杂交种子 |
| breed true | zachovat vlastnosti v potomstvu | sortenecht fallen | reproduire fidèlement ses caractères | conservar fielmente sus características | manter as características na descendência | сохранять сортовые признаки в потомстве | 后代性状保持稳定 |
| isolation distance | izolační vzdálenost | Isolationsabstand | distance d’isolement | distancia de aislamiento | distância de isolamento | пространственная изоляция | 隔离距离 |
| seed maturity | zralost semen | Samenreife | maturité des graines | madurez de las semillas | maturidade das sementes | зрелость семян | 种子成熟度 |
| seed stock | zásoba osiva | Saatgutbestand | réserve de semences | reserva de semillas | estoque de sementes | запас семян | 种子储备 |
| certified seed potato | certifikovaná sadba brambor | zertifizierte Pflanzkartoffeln | plants de pommes de terre certifiés | patata de siembra certificada | batata-semente certificada | сертифицированный семенной картофель | 认证种薯 |
| true seed *(versus tuber)* | pravé semeno | echtes Saatgut | graine véritable | semilla botánica | semente verdadeira | ботаническое семя | 实生种子 |
| preserve the harvest | uchovat úrodu | die Ernte haltbar machen | conserver la récolte | conservar la cosecha | conservar a colheita | сохранить урожай | 保存收成 |
| simmer | pomalu povařit | sanft köcheln | mijoter | cocer a fuego lento | cozinhar em fogo baixo | варить на медленном огне | 慢火熬煮 |
| dry | sušit | trocknen | sécher | secar | secar | сушить | 干燥 |
| ferment / lacto-ferment | kvasit / mléčně kvasit | fermentieren / milchsauer vergären | fermenter / lactofermenter | fermentar / lactofermentar | fermentar / fazer fermentação lática | квасить / молочнокисло ферментировать | 发酵／乳酸发酵 |
| cold store | chladný sklad / sklep | kühles Lager | cellier frais | almacén fresco | despensa fresca | прохладное хранилище | 阴凉储藏处 |
| fermentation crock | kameninový kvasicí hrnec | Gärtopf | pot de fermentation en grès | vasija de fermentación | pote de fermentação | ёмкость для квашения | 发酵坛 |
| root clamp / clamp storage | krecht / krechtování | Erdmiete / Einmieten | silo de conservation en terre | silo de tierra | armazenamento em leira ou silo | бурт / хранение в бурте | 土窖储藏 |

Do not make translated preservation text sound like a complete food-safety recipe. The game teaches matching crops to broad methods, not validated processing times, acidity or storage temperatures.

### Preserved foods

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| cherry jam | třešňový džem | Kirschkonfitüre | confiture de cerises | mermelada de cereza | geleia de cereja | варенье из вишни / черешни podle odrůdy | 樱桃果酱 |
| dried apples | sušená jablka | getrocknete Äpfel | pommes séchées | manzanas secas | maçãs secas | сушёные яблоки | 苹果干 |
| sauerkraut | kysané zelí | Sauerkraut | chou lactofermenté *(choucroute)* | chucrut | chucrute | квашеная капуста | 发酵卷心菜 |
| dried herbs | sušené bylinky | getrocknete Kräuter | herbes séchées | hierbas secas | ervas secas | сушёные травы | 干燥香草 |
| fermented root vegetables | kvašená kořenová zelenina | fermentiertes Wurzelgemüse | légumes-racines lactofermentés | hortalizas de raíz fermentadas | hortaliças de raiz fermentadas | квашеные корнеплоды | 发酵根菜 |
| clamped potatoes | brambory uložené v krechtu | eingemietete Kartoffeln | pommes de terre conservées en silo | patatas conservadas en silo de tierra | batatas armazenadas em leira ou silo | картофель в бурте | 窖藏马铃薯 |
| clamped root vegetables | kořenová zelenina uložená v krechtu | eingemietetes Wurzelgemüse | légumes-racines conservés en silo | hortalizas de raíz conservadas en silo de tierra | hortaliças de raiz armazenadas em leira ou silo | корнеплоды в бурте | 窖藏根菜 |

### Wildlife ecology and fungi

| English | `cs` | `de` | `fr` | `es` | `pt-BR` | `ru` | `zh-CN` |
|---|---|---|---|---|---|---|---|
| larval host plant | živná rostlina housenek | Raupenfutterpflanze | plante-hôte des chenilles | planta hospedera de las orugas | planta hospedeira das lagartas | кормовое растение гусениц | 幼虫寄主植物 |
| cavity-nesting bird | pták hnízdící v dutinách | Höhlenbrüter | oiseau cavernicole | ave que anida en cavidades | ave que nidifica em cavidades | птица, гнездящаяся в дуплах | 洞巢型鸟类 |
| chrysalis | kukla | Puppe | chrysalide | crisálida | crisálida | куколка | 蛹 |
| natural predator | přirozený predátor | natürlicher Gegenspieler | prédateur naturel | depredador natural | predador natural | естественный хищник | 天敌 |
| pest pressure | tlak organismů poškozujících úrodu | Schädlingsdruck | pression des ravageurs | presión de plagas | pressão de pragas | давление вредителей | 害虫压力 |
| outbreak | přemnožení | Massenauftreten / Befall | pullulation | brote | surto | вспышка численности | 种群暴发 |
| broad-spectrum pesticide | širokospektrální pesticid | Breitbandpestizid | pesticide à large spectre | pesticida de amplio espectro | pesticida de amplo espectro | пестицид широкого спектра | 广谱农药 |
| mycelium | podhoubí | Myzel | mycélium | micelio | micélio | мицелий | 菌丝体 |
| fruiting body | plodnice | Fruchtkörper | sporophore | cuerpo fructífero | corpo de frutificação | плодовое тело | 子实体 |
| verified mushroom spawn | houbová sadba z ověřeného zdroje | Pilzbrut aus verlässlicher Quelle | mycélium de culture provenant d’une source fiable | micelio de cultivo de procedencia verificada | inoculante micelial de procedência verificada | проверенный посадочный мицелий | 来源可靠的菌种 |
| fruiting is not guaranteed | tvorba plodnic není zaručena | Fruchtkörper sind nicht garantiert | la fructification n’est pas garantie | la fructificación no está garantizada | a frutificação não é garantida | образование плодовых тел не гарантировано | 不保证出菇 |
| leaf litter | listový opad | Laubstreu | litière de feuilles | hojarasca | serapilheira | листовой опад | 落叶层 |
| hollow stems | duté stonky | hohle Stängel | tiges creuses | tallos huecos | caules ocos | полые стебли | 中空茎秆 |

Prefer “restore balance”, “limit damage” and “support predators” over “defeat”, “eliminate” or “win against pests”. Most species discussed have ecological roles beyond the immediate crop damage.

## 11. Typography, grammar and QA

### Punctuation and formatting

| Locale | Quotation marks and notes |
|---|---|
| `cs` | `„…“`; use non-breaking spaces after one-letter prepositions in final typesetting where practical. |
| `de` | `„…“`; preserve noun capitalization and `ß`. |
| `fr` | `« … »`; use non-breaking spaces before `: ; ? !` and curly apostrophe `’`. |
| `es` | `«…»` or `“…”`, but choose one per component; always use `¿…?` and `¡…!`. |
| `pt-BR` | `“…”`; keep Brazilian accents and vocabulary. |
| `pl` | `„…”`; preserve Polish diacritics and natural Polish sentence order. |
| `ru` | `«…»`; use an em dash in constructions such as `Проблема — это решение`. |
| `zh-CN` | `“……”` and full-width punctuation `，。！？：；`; do not add spaces around Chinese punctuation. |

Use locale-aware number, list, date and plural formatting. Never create plurals by appending a letter in code. Czech, Polish and Russian require several plural forms; Chinese normally uses one unchanged noun form.

### Required localization tests

- Every player-visible English string, including `aria-label`, `title`, `alt`, error, save/reset, certificate, offline and reduced-motion text, has a stable key.
- No English sentence leaks into a target locale except the protected names in section 2.
- Dynamic placeholders remain present exactly once and in a natural target-language order.
- Long German and Russian labels, French spacing and Chinese line breaks fit phone, tablet and desktop without clipping.
- The locale survives reload, save/restore and reset.
- The document `lang` is correct; all current locales remain left-to-right.
- Czech audio and Czech subtitles use exactly the same approved wording, apart from deliberate speech-friendly punctuation.
- English audio in non-Czech locales is labelled honestly as English; never imply localized narration.
- Fungi retain their scientific names and the safety warning.
- “Design connection” is never silently promoted to a full plant guild.
- “Shares” never becomes a financial share and “fair share” never becomes a game currency.
- A statement containing uncertainty in English remains equally cautious in translation.

## 12. Terminology anchors

Terminology was checked against these references on 28 July 2026:

- [Permaculture Association — Fair Share](https://www.permaculture.org.uk/ethics/fair-share)
- [Permaculture Principles — Portuguese ethics](https://permacultureprinciples.com/pt/pt_ethics.php)
- [Permaculture principles in Russian](https://files.permacultureprinciples.com/downloads/Essence_of_Pc_RU.pdf)
- [Russian Permaculture — ethics and principles](https://russianpermaculture.ru/permakulturnyi-dizain-etika-principy-permakultury/)
- [Simplified Chinese introduction to 朴门永续设计](https://www.cnctrip.com/permaculture.html)
- [Permakultura CS](https://www.permakulturacs.cz/)
- [Réseau français de permaculture](https://www.permaculture.fr/)
- [German Permakultur Institut — plant communities and guilds](https://www.permakultur.de/veranstaltung/onlinekurs-polykulturen-und-gilden)
- [GBIF — *Stropharia rugosoannulata* vernacular names](https://www.gbif.org/species/2533347)
- [Česká mykologická společnost — límcovka vrásčitoprstenná](https://www.myko.cz/poradna/z-vasich-dotazu/)

This glossary is the translation authority for the game. If a later native-speaker or subject-matter review changes a term, update this file first, then update every locale pack and subtitle that uses it.
