const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (dirPath.endsWith('.jsx')) {
      callback(path.join(dirPath));
    }
  });
}

const regexList = [
  // <Button ... disabled={mutation.isPending} ...>
  // match <Button ... disabled={x.isPending}
  {
    regex: /(<Button[^>]*?)disabled=\{([^}]+\.isPending)\}/g,
    replace: '$1isLoading={$2}'
  },
  // disabled={isSubmitting}
  {
    regex: /(<Button[^>]*?)disabled=\{isSubmitting\}/g,
    replace: '$1isLoading={isSubmitting}'
  },
  // disabled={isUpdating}
  {
    regex: /(<Button[^>]*?)disabled=\{isUpdating\}/g,
    replace: '$1isLoading={isUpdating}'
  },
  // disabled={isImporting}
  {
    regex: /(<Button[^>]*?)disabled=\{isImporting\}/g,
    replace: '$1isLoading={isImporting}'
  },
  // disabled={isApproving}
  {
    regex: /(<Button[^>]*?)disabled=\{isApproving\}/g,
    replace: '$1isLoading={isApproving}'
  },
  // disabled={isRejecting}
  {
    regex: /(<Button[^>]*?)disabled=\{isRejecting\}/g,
    replace: '$1isLoading={isRejecting}'
  },
  // disabled={isCreating}
  {
    regex: /(<Button[^>]*?)disabled=\{isCreating\}/g,
    replace: '$1isLoading={isCreating}'
  },
  // disabled={isSaving}
  {
    regex: /(<Button[^>]*?)disabled=\{isSaving\}/g,
    replace: '$1isLoading={isSaving}'
  },
];

let modifiedFiles = 0;

walkDir('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  regexList.forEach(({ regex, replace }) => {
    newContent = newContent.replace(regex, replace);
  });

  // some buttons might have something like disabled={mutation.isPending || !isValid}
  // replace with isLoading={mutation.isPending} disabled={!isValid}
  const complexRegex = /(<Button[^>]*?)disabled=\{([^}]+\.isPending)\s*\|\|\s*([^}]+)\}/g;
  newContent = newContent.replace(complexRegex, '$1isLoading={$2} disabled={$3}');

  const complexRegex2 = /(<Button[^>]*?)disabled=\{([^}]+\.isPending)\s*\|\|\s*([^}]+)\s*\|\|\s*([^}]+)\}/g;
  newContent = newContent.replace(complexRegex2, '$1isLoading={$2} disabled={$3 || $4}');
  
  const complexRegex3 = /(<Button[^>]*?)disabled=\{([^}]*!isValid)\s*\|\|\s*([^}]+\.isPending)\}/g;
  newContent = newContent.replace(complexRegex3, '$1disabled={$2} isLoading={$3}');
  
  // same for isSubmitting
  const complexSubmitting = /(<Button[^>]*?)disabled=\{isSubmitting\s*\|\|\s*([^}]+)\}/g;
  newContent = newContent.replace(complexSubmitting, '$1isLoading={isSubmitting} disabled={$2}');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Modified ${filePath}`);
    modifiedFiles++;
  }
});

console.log(`Finished. Modified ${modifiedFiles} files.`);
