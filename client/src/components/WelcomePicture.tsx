import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

/** A small card with its four moves around it. Each move lights in turn on an 8 second loop. Hidden from screen readers; the words below say it. */
export function WelcomePicture() {
  return (
    <>
      <div className="wpic" aria-hidden="true">
        <div className="wpic__card">
          <div className="wpic__sender">
            <span className="wpic__dot" />
            <span className="wpic__name" />
          </div>
          <p className="voice wpic__ask">
            What it needs
            <br />
            from you
          </p>
          <div className="wpic__rule" />
          <div className="wpic__lines">
            <span />
            <span className="wpic__line--mark" />
            <span />
          </div>
        </div>
        <span className="wpic__label wpic__label--right">
          Done
          <ArrowRight size={16} strokeWidth={1.75} />
        </span>
        <span className="wpic__label wpic__label--left">
          <ArrowLeft size={16} strokeWidth={1.75} />
          Later
        </span>
        <span className="wpic__label wpic__label--up">
          <ArrowUp size={16} strokeWidth={1.75} />
          To-do
        </span>
        <span className="wpic__label wpic__label--down">
          Skip
          <ArrowDown size={16} strokeWidth={1.75} />
        </span>
      </div>
      <p className="welcome__sr">Swipe right for Done, left for Later, up for To-do, down to skip. Each one also has a button.</p>
    </>
  );
}
