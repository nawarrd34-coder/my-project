// Deliberately slow synchronous script so the test page has a real performance issue.
var t = Date.now(); while (Date.now() - t < 350) {}
