// PCBend pre-launch page: the reservation, custom-project and idea forms.
//
// Email only, on purpose: nothing is sent from the page. Each form opens a pre-filled
// email in the visitor's own email app, and they choose whether to send it.
import { track } from '/pcbend/site.js';

const CONTACT = 'manas.16.bhargava@gmail.com';

const SUBJECTS = {
  reserve: 'PCBend: reserve my place',
  custom: 'PCBend: custom project',
  survey: 'PCBend: what I would show on it',
  idea: 'PCBend: what I would show on it',
};

// Field names as a person reads them in the email.
const LABELS = {
  email: 'Email', interest: 'Most interested in', country: 'Country',
  name: 'Name', company: 'Company', shape: 'Shape', quantity: 'Quantity',
  timeline: 'Timeline', idea: 'What I would show on it',
};

function mailtoFor(kind, data) {
  const lines = [];
  for (const [k, v] of data) {
    if (k === 'consent' || !String(v).trim()) continue;
    lines.push(`${LABELS[k] ?? k}: ${v}`);
  }
  if (kind === 'custom') lines.push('', 'Files: attach them to this email if you have any.');
  return `mailto:${CONTACT}?subject=${encodeURIComponent(SUBJECTS[kind])}&body=${encodeURIComponent(lines.join('\n'))}`;
}

for (const form of document.querySelectorAll('form[data-form]')) {
  const kind = form.dataset.form;
  const done = document.querySelector(`[data-done="${kind}"]`);

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);

    // A link click hands the email to the visitor's email app and leaves the page as is.
    const a = document.createElement('a');
    a.href = mailtoFor(kind, data);
    a.click();

    track({ reserve: 'signup', custom: 'custom_enquiry' }[kind] ?? 'idea', {
      interest: data.get('interest') ?? undefined,
    });
    if (done) {
      form.hidden = true;
      done.hidden = false;
      done.focus();
    }
  });
}

// Product buttons say which one they are for: pick it in the reservation form.
document.addEventListener('click', e => {
  const link = e.target.closest('[data-interest]');
  if (!link) return;
  const select = document.getElementById('reserve-interest');
  if (select) select.value = link.dataset.interest;
});
