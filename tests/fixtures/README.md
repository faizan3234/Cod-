# Scoreboard regression fixture

`cod-result-zoo.jpeg` is the screenshot supplied for this development task.
The visible final match score is **rizwanstriker 5–1 bowdownbro**. The first
name is blurry, so matching it to the existing roster remains a suggestion
that the uploader must confirm. The optional map is entered as Zoo during
the test; uncertain map text is not guessed by OCR.

`npm run test:sample` exercises actual OCR and the complete posting flow in a
temporary local league, then removes that league. This image never becomes
an initial match or a production result. Tests also use a generated tone to
verify device-local audio; no commercial soundtrack is included.
