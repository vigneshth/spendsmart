{ pkgs }: {
  deps = [
    pkgs.python311Full
    pkgs.python311Packages.flask
    pkgs.python311Packages.flask_sqlalchemy
    pkgs.python311Packages.werkzeug
    pkgs.python311Packages.requests
    pkgs.python311Packages.python-dotenv
  ];
}
