
let chart = null;
let trainerTask = null;
let previousTrainerExpression = "";

// Функция показывает ошибку у конкретного поля ввода
function setError(inputId, message) {

    const input = document.getElementById(inputId);
    const wrapper = input.closest(".input-wrapper");
    const errorBox = wrapper.querySelector(".field-error");

    input.classList.add("input-error");
    wrapper.classList.add("error");

    if (errorBox) errorBox.textContent = message;
}

// убирает ошибку только у одного поля
function clearError(input) {

    const wrapper = input.closest(".input-wrapper");
    const errorBox = wrapper.querySelector(".field-error");

    input.classList.remove("input-error");
    wrapper.classList.remove("error");

    if (errorBox) errorBox.textContent = "";
}

// очищает все ошибки поля ввода
function clearAllErrors() {

    document.querySelectorAll(".input-wrapper").forEach(w => {
        w.classList.remove("error");
        const err = w.querySelector(".field-error");
        if (err) err.textContent = "";
    });

    document.querySelectorAll("input").forEach(i => {
        i.classList.remove("input-error");
    });
}

// убирает лишние нули у числа
function format(num) {

    if (num === null || num === undefined || !isFinite(num)) return "-";

    // убираем лишние нули
    let rounded = Number(num.toFixed(6));

    // убираем ".0"
    return rounded % 1 === 0 ? rounded.toString() : rounded.toString();
}

// округление числа до 6 знаков
function clean(num) {
    if (!isFinite(num)) return null;
    return Math.round(num * 1e6) / 1e6;
}

// проверка числового ввода
function validateNumber(value, id, allowNegative = true, allowZero = true) {

    if (value === "" || value === null || value === undefined) {
        setError(id, "Заполните поле ввода");
        return null;
    }

    const prepared = value.trim().replace(",", "."); // 0,1 и 0.1 - одно и тоже
    const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    let num = Number(prepared);

    if (!numberPattern.test(prepared) || !Number.isFinite(num)) {
        setError(id, "Некорректное значение");
        return null;
    }

    // запрет отрицательных
    if (!allowNegative && num < 0) {
        setError(id, "Введи число больше 0");
        return null;
    }

    // запрет нуля
    if (!allowZero && num <= 0) {
        setError(id, "Введи число больше 0");
        return null;
    }

    // Значения S только целые числа
    if (id === "steps" && !Number.isInteger(num)) {
        setError(id, "Введите целое число");
        return null;
    }

    // Ограничение количества шагов для работы браузера
    if (id === "steps" && num > 200) {
        setError(id, "Максимум 200 шагов");
        return null;
    }

    return num;
}

// вычисление f(x, y)
function f(expr, x, y) {

    let prepared = expr;

    prepared = prepared
        .replace(/ctg/gi, "cot")
        .replace(/tg/gi, "tan")
        .replace(/ln/gi, "log")
        .replace(/√/g, "sqrt")

        .replace(/sin\s+([a-z0-9]+)/gi, "sin($1)")
        .replace(/cos\s+([a-z0-9]+)/gi, "cos($1)")
        .replace(/tg\s+([a-z0-9]+)/gi, "tan($1)")
        .replace(/ctg\s+([a-z0-9]+)/gi, "cot($1)")
        .replace(/ln\s+([a-z0-9]+)/gi, "log($1)")

        .replace(/(\d)([xy])/g, "$1*$2")
        .replace(/xy/g, "x*y");

    return math.evaluate(prepared, { x, y });
}

// проверка введенной функции
function validateFunction(expr) {

    if (!expr || expr.trim() === "") {
        setError("func", "Заполните поле ввода");
        return null;
    }

    if (/[а-яА-ЯёЁ]/.test(expr)) {
        setError("func", "Русские буквы недопустимы");
        return null;
    }

    if (/[+\-*/.]$/.test(expr)) {
        setError("func", "Некорректная функция");
        return null;
    }

    try {
        f(expr, 1, 1);
    }

    catch {
        setError("func", "Некорректная функция");
        return null;
    }

    return expr;
}

// создает функцию "точного" решения через линейное приближение
function exactSolution(expr, x0, y0) {

    try {
        const node = math.parse(expr);
        const compiled = node.compile();

        return (x) => {
            let k1 = compiled.evaluate({ x, y: y0 });
            return y0 + (x - x0) * k1;
        };

    } catch {
        return null;
    }
}

// (Метод Эйлера)
function solve() {

    clearAllErrors(); // очистка ошибок

    const expr = validateFunction(
        document.getElementById("func").value.trim()
    );

    const x0 = validateNumber(document.getElementById("x0").value, "x0", true, true);
    const y0 = validateNumber(document.getElementById("y0").value, "y0", true, true);
    const h = validateNumber(document.getElementById("h").value, "h", false, false);
    const steps = validateNumber(document.getElementById("steps").value, "steps", false, false);

    if (!expr || x0 === null || y0 === null || h === null || steps === null) {
        return;
    }

    let x = x0;
    let y = y0;
    let lastX = x;
    let lastY = y;

    let xValues = [];
    let yEuler = [];
    let yExact = [];

    let table = document.getElementById("table");
    let results = document.getElementById("results");

    results.classList.add("hidden");

    try {

        // Точное решение
        let hx = h / 50;
        let xe = x0;
        let ye = y0;

        let exactMap = new Map();

        for (let i = 0; i <= steps * 50; i++) {

            exactMap.set(parseFloat(xe.toFixed(6)), ye);

            ye = ye + hx * f(expr, xe, ye);
            xe = xe + hx;
        }

        // Формирование таблицы
        let html = `
            <table>
                <tr>
                    <th>n</th>
                    <th>x</th>
                    <th>y (Эйлер)</th>
                    <th>Точное решение</th>
                    <th>Погрешность</th>
                </tr>
        `;

        for (let i = 0; i <= steps; i++) {

            let xKey = parseFloat(x.toFixed(6));
            let exactY = exactMap.get(xKey);

            if (exactY === undefined || exactY === null || isNaN(exactY)) {
                exactY = y;
            }

            let error = Math.abs(exactY - y);

            html += `
                <tr>
                    <td>${i}</td>
                    <td>${format(x)}</td>
                    <td>${format(y)}</td>
                    <td>${format(exactY)}</td>
                    <td>${format(error)}</td>
                </tr>
            `;

            xValues.push(Number(format(x)));
            yEuler.push(Number(format(y)));
            yExact.push(Number(format(exactY)));

            // После последней строки таблицы лишний шаг не выполняется
            if (i < steps) {
                let fy = f(expr, x, y);

                y = y + h * fy;
                x = x + h;
            }

            lastX = x;
            lastY = y;
        }

        document.getElementById("graph-answer").innerHTML = `
            <div class="graph-answer-box">
                Ответ: y(${format(lastX)}) ≈ ${format(lastY)}
            </div>
        `;

        html += "</table>";

        table.innerHTML = html;
        results.classList.remove("hidden");
        document.querySelector(".calc").classList.add("compact");
        document.getElementById("solution-block")
            .classList.remove("hidden");

        drawChart(xValues, yEuler, yExact);
        eulerExplanation(expr, x0, y0, h, steps, x, y);

    } catch (error) {
        setError("func", error.message || "Ошибка вычисления");
        results.classList.add("hidden");
    }
}

// Построение графика
function drawChart(xValues, yEuler, yExact) {

    const ctx = document.getElementById("graph");

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: xValues.map(x => Number(x.toFixed(5))),
            datasets: [
                {
                    label: "Метод Эйлера",
                    data: yEuler,
                    borderColor: "#68705B",
                    backgroundColor: "#68705B",
                    pointBackgroundColor: "#68705B",
                    pointBorderColor: "#68705B",
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "Точное решение",
                    data: yExact,
                    borderColor: "#B07D62",
                    backgroundColor: "#B07D62",
                    pointBackgroundColor: "#B07D62",
                    pointBorderColor: "#B07D62",
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: "index",
                intersect: false
            }
        }
    });
}

//Полное решение методом Эйлера
function eulerExplanation(expr, x0, y0, h, steps, lastX, lastY, targetId = "euler-solution") {

    const box = document.getElementById(targetId);

    let html = "";

    html += "<br>";
    html += "<b>1. Дано:</b><br>";
    html += "y′ = " + formatTrainerEquation(expr) + "<br>";
    html += "x₀ = " + x0 + ", y₀ = " + y0 + "<br>";
    html += "h = " + h + "<br>";
    html += "шагов = " + steps + "<br><br>";

    html += "<b>2. Формула метода Эйлера:</b><br>";
    html += "yₙ₊₁ = yₙ + h · f(xₙ, yₙ)<br><br>";

    html += `
    <div class="step-start">
        <b>3. Решение по шагам:</b><br><br>
    </div>
    `;

    let x = x0;
    let y = y0;

    for (let i = 1; i <= steps; i++) {

        let fval = f(expr, x, y);
        let yNext = y + h * fval;
        let xNext = x + h;

        html += `<div class="step">`;
        html += "<b>Шаг " + i + ":</b><br>";

        html += "f(" + format(x) + ", " + format(y) + ") = " + format(fval) + "<br>";

        html += "y = " + format(y) + " + " + h + " · " + format(fval) +
                " = " + format(yNext) + "<br>";

        html += "x = " + format(x) + " + " + h +
        " = " + format(xNext) + "<br><br>";

        html += "</div>";

        y = yNext;
        x = xNext;
    }

    html += "<b>4. Подстановка:</b><br>";

    html += "Берем результат последнего шага и подставляем в формулу f(x, y):<br>";

    html += "x = " + format(lastX) + "<br>";
    html += "y = " + format(lastY) + "<br><br>";

    html += `
    <div class="answer">
        Ответ:<br>
        y(${format(lastX)}) ≈ ${format(lastY)}
    </div>
    `;

    box.innerHTML = html;
}

// Сброс
function resetAll() {

    clearAllErrors();

    document.querySelectorAll("#calculator-panel input").forEach(i => {
        i.value = "";
    });

    document.getElementById("table").innerHTML = "";

    document.getElementById("results")
        .classList.add("hidden");

    document.querySelector(".calc")
        .classList.remove("compact");

    document.getElementById("solution-block")
        .classList.add("hidden");

    if (chart) {
        chart.destroy();
        chart = null;
    }
}

// Обработка ввода
document.querySelectorAll("#calculator-panel input").forEach(input => {

    input.addEventListener("input", () => {
        clearError(input);
    });

    input.addEventListener("focus", () => {
        clearError(input);
    });
});

/*Переключение разделов*/
function switchMode(mode) {

    const calculator = document.getElementById("calculator-panel");
    const trainer = document.getElementById("trainer-panel");
    const calculatorButton = document.getElementById("tab-calculator");
    const trainerButton = document.getElementById("tab-trainer");

    if (mode === "calculator") {

        calculator.classList.remove("hidden");
        trainer.classList.add("hidden");
        calculatorButton.classList.add("active");
        trainerButton.classList.remove("active");

        if (chart) chart.resize();

    } else {

        calculator.classList.add("hidden");
        trainer.classList.remove("hidden");
        calculatorButton.classList.remove("active");
        trainerButton.classList.add("active");
    }
}

// Настройки трех уровней сложности
const trainerLevels = {

    easy: {
        x0: [0, 1],
        y0: [1, 2, 3],
        h: [0.1, 0.2],
        steps: [1, 2],
        equations: [
            (a, b) => `${a}*x + ${b}*y`,
            (a, b) => `${a}*x + ${b}`,
            (a, b) => `${a}*y + ${b}`
        ]
    },

    medium: {
        x0: [0, 1],
        y0: [1, 2],
        h: [0.1],
        steps: [2, 3],
        equations: [
            (a, b) => `${a}*x^2 + ${b}*y`,
            (a, b) => `${a}*x*y + ${b}`,
            (a, b) => `${a}*x + ${b}*y^2`
        ]
    },

    hard: {
        x0: [0, 1],
        y0: [1, 2],
        h: [0.1],
        steps: [3, 4],
        equations: [
            (a, b) => `${a}*y*sin(x) + ${b}*x`,
            (a, b) => `${a}*x^2 + ${b}*x*y`,
            (a, b) => `${a}*y*cos(x) + ${b}`
        ]
    }
};

// Выбор случайного значения
function trainerRandom(items) {
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}

// Вычисление ответа тренажера по старому алгоритму метода Эйлера
function calculateTrainerEquation(task) {

    let x = task.x0;
    let y = task.y0;

    for (let i = 0; i < task.steps; i++) {
        let fy = f(task.expression, x, y);
        y = y + task.h * fy;
        x = x + task.h;

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error("Ошибка вычисления");
        }
    }

    return { lastX: x, lastY: y };
}

// Генерация нового уравнения
function generateTrainerTask() {

    const level = document.getElementById("difficulty").value;
    const settings = trainerLevels[level];

    for (let attempt = 0; attempt < 100; attempt++) {

        const a = trainerRandom([1, 2, 3]);
        const b = trainerRandom([1, 2, 3]);
        const template = trainerRandom(settings.equations);
        const expression = template(a, b);

        // Уравнение не должно повторяться два раза подряд
        if (expression === previousTrainerExpression) continue;

        const task = {
            expression: expression,
            x0: trainerRandom(settings.x0),
            y0: trainerRandom(settings.y0),
            h: trainerRandom(settings.h),
            steps: trainerRandom(settings.steps)
        };

        try {
            const result = calculateTrainerEquation(task);
            if (Math.abs(result.lastY) > 100000) continue;

            task.correctAnswer = result.lastY;
            task.lastX = result.lastX;
            previousTrainerExpression = expression;
            return task;

        } catch {
            // Если параметры не подходят, создаем другое задание
        }
    }

    throw new Error("Не удалось создать новое уравнение");
}

// Оформление уравнения для тренажера
function formatTrainerEquation(expression) {
    return expression
        .replace(/\b1\*x\b/g, "x")
        .replace(/\b1\*y\b/g, "y")

        .replace(/(\d+)\*x\^2/g, "$1x²")
        .replace(/(\d+)\*y\^2/g, "$1y²")

        .replace(/(\d+)\*x\b/g, "$1x")
        .replace(/(\d+)\*y\b/g, "$1y")

        .replace(/x\*y/g, "xy")
        .replace(/y\*x/g, "yx")

        .replace(/(\d+)\*x\*y/g, "$1xy")
        .replace(/(\d+)\*y\*x/g, "$1yx")

        .replace(/x\^2/g, "x²")
        .replace(/y\^2/g, "y²");
}

// Очистка предыдущего ответа
function clearTrainerResult() {

    document.getElementById("student-answer").value = "";

    const resultBox = document.getElementById("check-result");
    resultBox.className = "check-result hidden";
    resultBox.innerHTML = "";

    document.getElementById("trainer-solution-block")
        .classList.add("hidden");

    document.getElementById("trainer-solution").innerHTML = "";
}

// Отображение нового задания
function showTrainerTask() {

    clearTrainerResult();

    try {
        trainerTask = generateTrainerTask();

        document.getElementById("task-equation").textContent =
            "y′ = " + formatTrainerEquation(trainerTask.expression);

        document.getElementById("task-conditions").innerHTML = `
            <div>x₀ = ${format(trainerTask.x0)}</div>
            <div>y₀ = ${format(trainerTask.y0)}</div>
            <div>h = ${format(trainerTask.h)}</div>
            <div>s = ${trainerTask.steps}</div>
        `;

    } catch (error) {
        trainerTask = null;
        document.getElementById("task-equation").textContent = error.message;
        document.getElementById("task-conditions").innerHTML = "";
    }
}

// Проверка ответа студента
function checkTrainerAnswer() {

    if (!trainerTask) return;

    const input = document.getElementById("student-answer").value.trim();
    const resultBox = document.getElementById("check-result");
    const normalized = input.replace(",", ".");
    const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

    if (!numberPattern.test(normalized) || !Number.isFinite(Number(normalized))) {
        resultBox.className = "check-result incorrect";
        resultBox.textContent = "Введите корректное число";
        document.getElementById("trainer-solution-block").classList.add("hidden");
        return;
    }

    const studentAnswer = Number(normalized);
    const correctAnswer = Number(trainerTask.correctAnswer.toFixed(3));
    const isCorrect = Math.abs(studentAnswer - correctAnswer) < 0.0005;

    if (isCorrect) {
        resultBox.className = "check-result correct";
        resultBox.textContent = "ПРАВИЛЬНО!";

    } else {
        resultBox.className = "check-result incorrect";
        resultBox.innerHTML = "";

        const title = document.createElement("strong");
        title.textContent = "НЕПРАВИЛЬНО!";

        const detail = document.createElement("p");
        detail.textContent = "Правильный ответ: " +
            String(correctAnswer).replace(".", ",");

        resultBox.append(title, detail);
    }

    // Одно и то же пошаговое решение для калькулятора и тренажера
    eulerExplanation(
        trainerTask.expression,
        trainerTask.x0,
        trainerTask.y0,
        trainerTask.h,
        trainerTask.steps,
        trainerTask.lastX,
        trainerTask.correctAnswer,
        "trainer-solution"
    );

    document.getElementById("trainer-solution-block")
        .classList.remove("hidden");
}

// Обработка кнопок тренажера
function initTrainer() {

    document.getElementById("new-equation")
        .addEventListener("click", showTrainerTask);

    document.getElementById("difficulty")
        .addEventListener("change", showTrainerTask);

    document.getElementById("check-answer")
        .addEventListener("click", checkTrainerAnswer);

    document.getElementById("student-answer")
        .addEventListener("keydown", function(event) {
            if (event.key === "Enter") checkTrainerAnswer();
        });

    document.getElementById("student-answer")
        .addEventListener("input", function() {
            document.getElementById("check-result").classList.add("hidden");
            document.getElementById("trainer-solution-block").classList.add("hidden");
        });

    document.getElementById("tab-calculator")
        .addEventListener("click", function() {
            switchMode("calculator");
        });

    document.getElementById("tab-trainer")
        .addEventListener("click", function() {
            switchMode("trainer");
        });

    showTrainerTask();
    switchMode("trainer");
}

// Первоначальный запуск сайта
initTrainer();
